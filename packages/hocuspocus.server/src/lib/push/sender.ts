/**
 * Push Notification Sender
 *
 * Handles sending web push notifications via VAPID.
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { pushLogger } from '../logger'
import { config } from '../../config/env'
import type { PushNotificationRequest, PushSubscription, PushSendResult } from '../../types/push.types'

// Configure web-push with VAPID credentials
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

/**
 * Get Supabase client for database operations
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(request: PushNotificationRequest): Promise<PushSendResult> {
  if (!vapidConfigured) {
    return { success: false, sent: 0, total: 0, error: 'VAPID not configured' }
  }

  const supabase = getSupabaseClient()

  // Get user's active web push subscriptions
  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', request.user_id)
    .eq('platform', 'web')
    .eq('is_active', true)

  if (fetchError) {
    pushLogger.error({ err: fetchError, user_id: request.user_id }, 'Failed to fetch push subscriptions')
    return { success: false, sent: 0, total: 0, error: fetchError.message }
  }

  if (!subscriptions?.length) {
    pushLogger.debug({ user_id: request.user_id }, 'No active push subscriptions')
    return { success: true, sent: 0, total: 0 }
  }

  // Build payload for service worker
  const pushPayload = JSON.stringify({
    notification_id: request.notification_id,
    type: request.type,
    sender_name: request.sender_name,
    sender_avatar: request.sender_avatar,
    message_preview: request.message_preview,
    action_url: request.action_url,
    channel_id: request.channel_id
  })

  // Send to all subscriptions
  const results = await Promise.allSettled(
    subscriptions.map(async (sub: PushSubscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.push_credentials.endpoint,
            keys: sub.push_credentials.keys
          },
          pushPayload
        )

        // Update last_used_at and reset failed_count
        await supabase
          .from('push_subscriptions')
          .update({
            last_used_at: new Date().toISOString(),
            failed_count: 0,
            last_error: null
          })
          .eq('id', sub.id)

        pushLogger.debug({ subscription_id: sub.id }, 'Push sent successfully')
        return { success: true, id: sub.id }
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string }
        pushLogger.warn({ subscription_id: sub.id, statusCode: error.statusCode }, 'Push failed')

        // Handle expired/invalid subscriptions
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .update({
              is_active: false,
              last_error: 'Subscription expired or invalid'
            })
            .eq('id', sub.id)
        } else {
          // Increment failed count
          await supabase
            .from('push_subscriptions')
            .update({
              failed_count: (sub.failed_count || 0) + 1,
              last_error: error.message || 'Unknown error'
            })
            .eq('id', sub.id)
        }

        return { success: false, id: sub.id, error: error.message }
      }
    })
  )

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && (r.value as { success: boolean }).success
  ).length

  pushLogger.info({
    user_id: request.user_id,
    notification_id: request.notification_id,
    sent: successful,
    total: subscriptions.length
  }, 'Push notification batch completed')

  return {
    success: successful > 0 || subscriptions.length === 0,
    sent: successful,
    total: subscriptions.length,
    results: results.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, id: '', error: 'Promise rejected' }
    )
  }
}

