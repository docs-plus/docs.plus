/**
 * Push Notification pgmq Consumer
 *
 * Polls Supabase pgmq queue for push notification events and processes them.
 *
 * ARCHITECTURE:
 *   Supabase Trigger → pgmq queue → This Consumer → BullMQ → Web Push API
 *
 * WHY pgmq INSTEAD OF pg_net?
 *   ✅ Never lose messages (queue persists even if backend is down)
 *   ✅ No exposed HTTP endpoint (security improvement)
 *   ✅ Auto-retry built into queue semantics
 *   ✅ Same pattern as document_views (consistency)
 *   ✅ $0 cost at any scale
 *   ⚠️ 2-5 second delay (acceptable for push notifications)
 *
 * @see docs/PUSH_NOTIFICATION_PGMQ.md
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

import { config } from '../../config/env'
import type { PushNotificationRequest } from '../../types/push.types'
import { pushLogger } from '../logger'
import { queuePush } from './queue'

// Consumer configuration
const POLL_INTERVAL_MS = 2000 // Poll every 2 seconds
const BATCH_SIZE = 50 // Process up to 50 messages per poll
const VISIBILITY_TIMEOUT = 30 // Seconds before message becomes visible again

interface QueueMessage {
  msg_id: number
  payload: {
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
  enqueued_at: string
}

// Singleton Supabase client
let supabase: SupabaseClient | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let isProcessing = false
let isShuttingDown = false

// Metrics
let metrics = {
  messagesProcessed: 0,
  messagesFailed: 0,
  lastPollAt: null as Date | null,
  lastMessageAt: null as Date | null,
  consecutiveEmptyPolls: 0
}

/**
 * Initialize Supabase client for queue operations
 */
function getClient(): SupabaseClient | null {
  if (supabase) return supabase

  const url = config.supabase.url
  const key = config.supabase.serviceRoleKey

  if (!url || !key) {
    pushLogger.warn('Supabase not configured - pgmq consumer will not start')
    return null
  }

  supabase = createClient(url, key, {
    auth: { persistSession: false }
  })

  return supabase
}

/**
 * Read messages from the pgmq queue
 */
async function readQueue(): Promise<QueueMessage[]> {
  const client = getClient()
  if (!client) return []

  try {
    const { data, error } = await client.rpc('consume_push_queue', {
      p_batch_size: BATCH_SIZE,
      p_visibility_timeout: VISIBILITY_TIMEOUT
    })

    if (error) {
      pushLogger.error({ error }, 'Failed to read push queue')
      return []
    }

    return (data || []) as QueueMessage[]
  } catch (err) {
    pushLogger.error({ err }, 'Error reading push queue')
    return []
  }
}

/**
 * Acknowledge a processed message (removes from queue)
 */
async function ackMessage(msgId: number): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  try {
    const { error } = await client.rpc('ack_push_message', {
      p_msg_id: msgId
    })

    if (error) {
      pushLogger.error({ error, msgId }, 'Failed to ack push message')
      return false
    }

    return true
  } catch (err) {
    pushLogger.error({ err, msgId }, 'Error acking push message')
    return false
  }
}

/**
 * Process a single queue message
 */
async function processMessage(message: QueueMessage): Promise<boolean> {
  const { msg_id, payload } = message

  try {
    // Build push payload for BullMQ worker
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

    // Queue to BullMQ for actual push sending
    const jobId = await queuePush({
      type: 'notification',
      payload: pushPayload,
      created_at: new Date().toISOString()
    })

    if (!jobId) {
      pushLogger.warn({ msgId: msg_id }, 'Failed to queue push job - queue may be unavailable')
      // Don't ack - let it retry
      return false
    }

    // Message processed successfully - acknowledge it
    const acked = await ackMessage(msg_id)
    if (!acked) {
      pushLogger.warn({ msgId: msg_id }, 'Failed to ack message - may be reprocessed')
    }

    pushLogger.debug(
      { msgId: msg_id, jobId, userId: payload.user_id, type: payload.type },
      'Push notification queued from pgmq'
    )

    metrics.messagesProcessed++
    metrics.lastMessageAt = new Date()

    return true
  } catch (err) {
    pushLogger.error({ err, msgId: msg_id }, 'Error processing push queue message')
    metrics.messagesFailed++
    return false
  }
}

/**
 * Poll the queue and process messages
 */
async function pollQueue(): Promise<void> {
  if (isProcessing || isShuttingDown) return

  isProcessing = true
  metrics.lastPollAt = new Date()

  try {
    const messages = await readQueue()

    if (messages.length === 0) {
      metrics.consecutiveEmptyPolls++
      isProcessing = false
      return
    }

    metrics.consecutiveEmptyPolls = 0

    pushLogger.debug({ count: messages.length }, 'Processing push queue batch')

    // Process messages in parallel (but with concurrency limit)
    const results = await Promise.allSettled(messages.map((m) => processMessage(m)))

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length
    const failed = results.length - succeeded

    if (failed > 0) {
      pushLogger.warn({ succeeded, failed }, 'Some push queue messages failed')
    }
  } catch (err) {
    pushLogger.error({ err }, 'Error in push queue poll cycle')
  } finally {
    isProcessing = false
  }
}

/**
 * Start the pgmq consumer
 *
 * IMPORTANT: Call this only from hocuspocus-worker, NOT from rest-api.
 */
export function startPushQueueConsumer(): boolean {
  if (pollInterval) {
    pushLogger.warn('Push queue consumer already running')
    return false
  }

  const client = getClient()
  if (!client) {
    pushLogger.error('Cannot start push queue consumer - Supabase not configured')
    return false
  }

  pushLogger.info(
    {
      pollInterval: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      visibilityTimeout: VISIBILITY_TIMEOUT
    },
    'Starting push queue consumer (pgmq architecture)'
  )

  // Initial poll
  pollQueue()

  // Start polling
  pollInterval = setInterval(pollQueue, POLL_INTERVAL_MS)

  return true
}

/**
 * Stop the pgmq consumer gracefully
 */
export async function stopPushQueueConsumer(): Promise<void> {
  isShuttingDown = true

  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  // Wait for current processing to complete
  let waitCount = 0
  while (isProcessing && waitCount < 10) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    waitCount++
  }

  pushLogger.info(
    {
      messagesProcessed: metrics.messagesProcessed,
      messagesFailed: metrics.messagesFailed
    },
    'Push queue consumer stopped'
  )
}

/**
 * Get consumer health metrics
 */
export function getPushQueueConsumerHealth(): {
  running: boolean
  metrics: typeof metrics
} {
  return {
    running: pollInterval !== null && !isShuttingDown,
    metrics: { ...metrics }
  }
}
