/**
 * Poll/ack/metrics/lifecycle live in the shared createPgmqConsumer; this module
 * owns only the push-specific message mapping and RPC names.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { PushNotificationRequest } from '../../types/push.types'
import { chatLink, type ChatSource } from '../chatLink'
import { captureUnknown } from '../instrument'
import { pushLogger } from '../logger'
import { type PadLinkRow, readPadLinkRows } from '../padLink'
import { createPgmqConsumer, type PgmqConsumerContext } from '../pgmqConsumer'
import { prisma } from '../prisma'
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

const PAD_ROW_CACHE_TTL_MS = 60_000
const PAD_ROW_CACHE_MAX = 500

/**
 * One chat message fans out to every member in the same batch, so the Prisma
 * read is shared. The promise is cached, so parallel rows wait on one read.
 */
const padRowCache = new Map<string, { row: Promise<PadLinkRow | null>; expiresAt: number }>()

function readPadRow(documentId: string): Promise<PadLinkRow | null> {
  const now = Date.now()
  const hit = padRowCache.get(documentId)
  if (hit && hit.expiresAt > now) return hit.row

  if (padRowCache.size >= PAD_ROW_CACHE_MAX) padRowCache.clear()
  const row = readPadLinkRows(prisma, [documentId]).then((rows) => rows[0] ?? null)
  // A failed read must not stick for the whole TTL. The guard spares a newer entry.
  row.catch(() => {
    if (padRowCache.get(documentId)?.row === row) padRowCache.delete(documentId)
  })
  padRowCache.set(documentId, { row, expiresAt: now + PAD_ROW_CACHE_TTL_MS })
  return row
}

async function readChatNotification(
  client: SupabaseClient | null,
  notificationId: string
): Promise<ChatSource | null> {
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

/** A failed lookup costs the deep link, not the push: the service worker still opens `/`. */
async function chatActionUrl(payload: PushQueuePayload, ctx: PgmqConsumerContext): Promise<string> {
  try {
    return await chatLink.forPush(payload, {
      readSource: () => readChatNotification(ctx.getClient(), payload.notification_id),
      readPadRow
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
