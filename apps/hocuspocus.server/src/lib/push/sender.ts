import webpush from 'web-push'

import { config } from '../../config/env'
import type {
  PushNotificationRequest,
  PushSendResult,
  PushSubscription
} from '../../types/push.types'
import { pushLogger } from '../logger'
import { isSafeUrl, resolvesToPublicAddress } from '../ssrf'
import { getServiceRoleClient } from '../supabase'

let vapidConfigured = false

export function configureVapid(): boolean {
  const { publicKey, privateKey, subject } = config.push.vapid

  if (!publicKey || !privateKey) {
    pushLogger.warn('VAPID keys not configured - push notifications disabled')
    return false
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidConfigured = true
    pushLogger.info({ subject }, 'VAPID configured successfully')
    return true
  } catch (err) {
    pushLogger.error({ err }, 'Failed to configure VAPID')
    return false
  }
}

export function isVapidConfigured(): boolean {
  return vapidConfigured
}

/** Service-role client for subscription reads/updates; throws if unconfigured. */
function getSupabaseClient() {
  const supabase = getServiceRoleClient()
  if (!supabase) {
    throw new Error('Supabase credentials not configured')
  }
  return supabase
}

type SupabaseLike = ReturnType<typeof getSupabaseClient>

const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE'
])

// A bad p256dh or auth key fails before any send, with no status or an ERR_* code.
// Only a real transport failure is transient, so only that one adds nothing to failed_count.
function isNetworkError(error: { code?: unknown; message?: string }): boolean {
  return (
    (typeof error.code === 'string' && NETWORK_ERROR_CODES.has(error.code)) ||
    error.message === 'Socket timeout'
  )
}

/**
 * Success/invalid rows share identical values so each is one `.in()` UPDATE;
 * failures group by their (failed_count, last_error) pair to keep queries low.
 */
async function flushSubscriptionUpdates(
  supabase: SupabaseLike,
  successIds: string[],
  invalidIds: string[],
  failures: { id: string; failed_count: number; last_error: string }[]
): Promise<void> {
  const writes: PromiseLike<unknown>[] = []

  if (successIds.length > 0) {
    writes.push(
      supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), failed_count: 0, last_error: null })
        .in('id', successIds)
    )
  }

  if (invalidIds.length > 0) {
    writes.push(
      supabase
        .from('push_subscriptions')
        .update({ is_active: false, last_error: 'Subscription expired or invalid' })
        .in('id', invalidIds)
    )
  }

  const failureGroups = new Map<
    string,
    { ids: string[]; failed_count: number; last_error: string }
  >()
  for (const f of failures) {
    const key = `${f.failed_count}|${f.last_error}`
    const group = failureGroups.get(key)
    if (group) group.ids.push(f.id)
    else
      failureGroups.set(key, {
        ids: [f.id],
        failed_count: f.failed_count,
        last_error: f.last_error
      })
  }
  for (const group of failureGroups.values()) {
    writes.push(
      supabase
        .from('push_subscriptions')
        .update({ failed_count: group.failed_count, last_error: group.last_error })
        .in('id', group.ids)
    )
  }

  await Promise.allSettled(writes)
}

export async function sendPushNotification(
  request: PushNotificationRequest
): Promise<PushSendResult> {
  if (!vapidConfigured) {
    return { success: false, sent: 0, total: 0, error: 'VAPID not configured' }
  }

  const supabase = getSupabaseClient()

  // Every PWA platform uses VAPID with the same endpoint/keys format, so web,
  // iOS and Android all ride one query and one webpush.sendNotification path.
  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', request.user_id)
    .in('platform', ['web', 'ios', 'android'])
    .eq('is_active', true)

  if (fetchError) {
    pushLogger.error(
      { err: fetchError, user_id: request.user_id },
      'Failed to fetch push subscriptions'
    )
    return { success: false, sent: 0, total: 0, error: fetchError.message }
  }

  if (!subscriptions?.length) {
    pushLogger.debug({ user_id: request.user_id }, 'No active push subscriptions')
    return { success: true, sent: 0, total: 0 }
  }

  const pushPayload = JSON.stringify({
    notification_id: request.notification_id,
    type: request.type,
    sender_name: request.sender_name,
    sender_avatar: request.sender_avatar,
    message_preview: request.message_preview,
    action_url: request.action_url,
    channel_id: request.channel_id
  })

  // Send to all subscriptions, bucketing the outcome. The per-row state writes can
  // then be flushed as batched queries below, instead of one UPDATE per send (N+1).
  const successIds: string[] = []
  const invalidIds: string[] = []
  const failures: { id: string; failed_count: number; last_error: string }[] = []
  let filtered = 0

  const results = await Promise.allSettled(
    subscriptions.map(async (sub: PushSubscription) => {
      // The endpoint is subscriber-written, so refuse what the filter rejects.
      // A refusal can be a bug in our own filter (#417), so skip the send and
      // leave the row alone. Log no endpoint detail.
      if (!isSafeUrl(sub.push_credentials.endpoint)) {
        filtered++
        pushLogger.warn({ subscription_id: sub.id }, 'Refused an unsafe push endpoint')
        return { success: false, id: sub.id, error: 'Unsafe endpoint' }
      }
      // A private DNS answer and a resolver blip are the same value here, so this
      // refuses one send and charges nothing. Push endpoints are a handful of shared
      // hosts, so one resolver problem refuses every subscription at once, and
      // failed_count >= 5 is what the cleanup job deactivates a real device on.
      if (!(await resolvesToPublicAddress(sub.push_credentials.endpoint))) {
        pushLogger.warn(
          { subscription_id: sub.id },
          'Push endpoint did not resolve to a public address'
        )
        return { success: false, id: sub.id, error: 'Unsafe endpoint' }
      }
      try {
        // A chat push is useless after a day; a hung socket must not hold a worker slot.
        await webpush.sendNotification(
          {
            endpoint: sub.push_credentials.endpoint,
            keys: sub.push_credentials.keys
          },
          pushPayload,
          { TTL: 86400, timeout: 10000 }
        )

        successIds.push(sub.id)
        pushLogger.debug({ subscription_id: sub.id }, 'Push sent successfully')
        return { success: true, id: sub.id }
      } catch (err: unknown) {
        const error = err as { statusCode?: number; code?: unknown; message?: string }
        const status = error.statusCode
        pushLogger.warn({ subscription_id: sub.id, statusCode: status }, 'Push failed')

        if (status === 404 || status === 410) {
          invalidIds.push(sub.id)
        } else {
          // 429, 5xx and network errors are transient and add nothing.
          // Charging them let one provider outage switch devices off (#417).
          const network = !status && isNetworkError(error)
          const transient = status ? status === 429 || status >= 500 : network
          failures.push({
            id: sub.id,
            failed_count: (sub.failed_count || 0) + (transient ? 0 : 1),
            last_error: status
              ? `HTTP ${status}`
              : network
                ? 'Network error'
                : 'Invalid subscription'
          })
        }

        return { success: false, id: sub.id, error: error.message }
      }
    })
  )

  await flushSubscriptionUpdates(supabase, successIds, invalidIds, failures)

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && (r.value as { success: boolean }).success
  ).length
  // A row the URL filter refuses was never sent, so it is not a failed delivery.
  // Counting it made the job retry and dead-letter on every notification for that user.
  // A row the DNS check refuses still counts, so a resolver blip can make the job retry.
  const attempted = subscriptions.length - filtered

  pushLogger.info(
    {
      user_id: request.user_id,
      notification_id: request.notification_id,
      sent: successful,
      total: subscriptions.length
    },
    'Push notification batch completed'
  )

  return {
    success: successful > 0 || attempted === 0,
    sent: successful,
    total: subscriptions.length,
    results: results.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, id: '', error: 'Promise rejected' }
    )
  }
}
