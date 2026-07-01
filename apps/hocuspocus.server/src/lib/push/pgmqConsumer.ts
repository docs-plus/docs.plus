/**
 * Push Notification pgmq Consumer
 *
 * Polls Supabase pgmq queue for push notification events and processes them.
 *
 * ARCHITECTURE:
 *   Supabase Trigger → pgmq queue → This Consumer → BullMQ → Web Push API
 *
 * Poll/ack/metrics/lifecycle live in the shared createPgmqConsumer; this module
 * owns only the push-specific message mapping and RPC names.
 *
 * @see docs/PUSH_NOTIFICATION_PGMQ.md
 */

import type { PushNotificationRequest } from '../../types/push.types'
import { captureUnknown } from '../instrument'
import { pushLogger } from '../logger'
import { createPgmqConsumer } from '../pgmqConsumer'
import { queuePush } from './queue'

const POLL_INTERVAL_MS = 2000 // Poll every 2 seconds
const BATCH_SIZE = 50 // Process up to 50 messages per poll
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

/**
 * Map one pgmq message to a BullMQ push job.
 * notification_id (the source notification row id) is the stable BullMQ jobId.
 * Unlike email, push has no Supabase status sink, so there is no status update.
 */
async function processPushMessage(payload: PushQueuePayload, msgId: number): Promise<boolean> {
  try {
    const pushPayload: PushNotificationRequest = {
      user_id: payload.user_id,
      notification_id: payload.notification_id,
      type: payload.type,
      sender_name: payload.sender_name || undefined,
      sender_avatar: payload.sender_avatar || undefined,
      message_preview: payload.message_preview || undefined,
      action_url: payload.action_url,
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

/**
 * Start the pgmq consumer.
 * IMPORTANT: Call this only from hocuspocus-worker, NOT from rest-api.
 */
export function startPushQueueConsumer(): boolean {
  return consumer.start()
}

export function stopPushQueueConsumer(): Promise<void> {
  return consumer.stop()
}

export function getPushQueueConsumerHealth() {
  return consumer.getHealth()
}
