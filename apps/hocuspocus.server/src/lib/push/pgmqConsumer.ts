/**
 * Poll/ack/metrics/lifecycle live in the shared createPgmqConsumer; this module
 * owns only the push-specific message mapping and RPC names.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { config } from '../../config/env'
import type { PushNotificationRequest } from '../../types/push.types'
import { captureUnknown } from '../instrument'
import { pushLogger } from '../logger'
import { createPgmqConsumer, type PgmqConsumerContext } from '../pgmqConsumer'
import { prisma } from '../prisma'
import { type ChatNotificationRow, resolveChatActionUrl } from './chatActionUrl'
import { queuePush } from './queue'

const POLL_INTERVAL_MS = 2000
const BATCH_SIZE = 50
const VISIBILITY_TIMEOUT = 30 // Seconds before message becomes visible again (matches worker lock)

interface PushQueuePayload {
  notification_id: string
  user_id: string
  type: string
  sender_name: string | null
  sender_avatar: string | null
  message_preview: string | null
  action_url: string
  channel_id: string | null
  enqueued_at: string
}

const SLUG_CACHE_TTL_MS = 60_000
const SLUG_CACHE_MAX = 500

/**
 * One chat message fans out to every member in the same batch, so the Prisma
 * read is shared. The promise is cached, so parallel rows wait on one read.
 */
const slugCache = new Map<string, { slug: Promise<string | null>; expiresAt: number }>()

function readSlug(documentId: string): Promise<string | null> {
  const now = Date.now()
  const hit = slugCache.get(documentId)
  if (hit && hit.expiresAt > now) return hit.slug

  if (slugCache.size >= SLUG_CACHE_MAX) slugCache.clear()
  const slug = prisma.documentMetadata
    .findUnique({ where: { documentId }, select: { slug: true } })
    .then((row) => row?.slug ?? null)
  // A failed read must not stick for the whole TTL.
  slug.catch(() => slugCache.delete(documentId))
  slugCache.set(documentId, { slug, expiresAt: now + SLUG_CACHE_TTL_MS })
  return slug
}

async function readChatNotification(
  client: SupabaseClient | null,
  notificationId: string
): Promise<ChatNotificationRow | null> {
  if (!client) return null
  const { data, error } = await client
    .from('notifications')
    .select('message_id, channel:channels(workspace_id)')
    .eq('id', notificationId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  // Many-to-one embeds arrive as an object; the untyped client infers an array.
  const channel = Array.isArray(data.channel) ? data.channel[0] : data.channel
  return { messageId: data.message_id ?? null, documentId: channel?.workspace_id ?? null }
}

/** A failed lookup costs the deep link, not the push: the worker still opens `/`. */
async function chatActionUrl(payload: PushQueuePayload, ctx: PgmqConsumerContext): Promise<string> {
  try {
    return await resolveChatActionUrl(payload, config.email.appUrl, {
      readNotification: (id) => readChatNotification(ctx.getClient(), id),
      readSlug
    })
  } catch (err) {
    pushLogger.warn(
      { err, notificationId: payload.notification_id },
      'Push chat link lookup failed'
    )
    return payload.action_url
  }
}

/**
 * notification_id (the source notification row id) is the stable BullMQ jobId.
 * Unlike email, push has no Supabase status sink, so there is no status update.
 */
async function processPushMessage(
  payload: PushQueuePayload,
  msgId: number,
  ctx: PgmqConsumerContext
): Promise<boolean> {
  try {
    const pushPayload: PushNotificationRequest = {
      user_id: payload.user_id,
      notification_id: payload.notification_id,
      type: payload.type,
      sender_name: payload.sender_name || undefined,
      sender_avatar: payload.sender_avatar || undefined,
      message_preview: payload.message_preview || undefined,
      action_url: await chatActionUrl(payload, ctx),
      channel_id: payload.channel_id || undefined
    }

    const jobId = await queuePush(
      { type: 'notification', payload: pushPayload, created_at: new Date().toISOString() },
      payload.notification_id ? `push-${payload.notification_id}` : undefined
    )

    if (!jobId) {
      pushLogger.warn({ msgId }, 'Failed to queue push job - queue may be unavailable')
      captureUnknown(new Error('pgmq push: BullMQ enqueue returned null'))
      return false
    }

    pushLogger.debug(
      { msgId, jobId, userId: payload.user_id, type: payload.type },
      'Push notification queued from pgmq'
    )
    return true
  } catch (err) {
    pushLogger.error({ err, msgId }, 'Error processing push queue message')
    captureUnknown(err)
    return false
  }
}

const consumer = createPgmqConsumer<PushQueuePayload>({
  label: 'push',
  logger: pushLogger,
  readRpc: 'consume_push_queue',
  ackRpc: 'ack_push_message',
  pollIntervalMs: POLL_INTERVAL_MS,
  batchSize: BATCH_SIZE,
  visibilityTimeout: VISIBILITY_TIMEOUT,
  processMessage: processPushMessage
})

/** Call this only from hocuspocus-worker, NOT from rest-api. */
export function startPushQueueConsumer(): boolean {
  return consumer.start()
}

export function stopPushQueueConsumer(): Promise<void> {
  return consumer.stop()
}

export function getPushQueueConsumerHealth() {
  return consumer.getHealth()
}
