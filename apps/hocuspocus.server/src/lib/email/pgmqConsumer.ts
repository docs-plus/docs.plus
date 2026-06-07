/**
 * Email Notification pgmq Consumer
 *
 * Polls Supabase pgmq queue for email notification events and processes them.
 *
 * ARCHITECTURE:
 *   Supabase email_queue → pg_cron → pgmq queue → This Consumer → BullMQ → SMTP
 *
 * WHY pgmq INSTEAD OF pg_net?
 *   ✅ Never lose messages (queue persists even if backend is down)
 *   ✅ No exposed HTTP endpoint (security improvement)
 *   ✅ Auto-retry built into queue semantics
 *   ✅ Same pattern as push notifications (consistency)
 *   ✅ $0 cost at any scale
 *
 * @see docs/NOTIFICATION_ARCHITECTURE_COMPARISON.md
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

import { config } from '../../config/env'
import type {
  DigestChannel,
  DigestDocument,
  DigestEmailRequest,
  DigestNotification,
  NotificationEmailRequest,
  NotificationType
} from '../../types/email.types'
import { emailLogger } from '../logger'
import { queueEmail } from './queue'

// Consumer configuration
const POLL_INTERVAL_MS = 2000 // Poll every 2 seconds
const BATCH_SIZE = 50 // Process up to 50 messages per poll
const VISIBILITY_TIMEOUT = 60 // Seconds before message becomes visible again

interface EmailQueueMessage {
  msg_id: number
  payload: {
    // Individual notification fields
    queue_id?: string
    to?: string
    recipient_name?: string
    recipient_id?: string
    sender_name?: string
    sender_id?: string
    sender_avatar_url?: string | null
    notification_type?: string
    message_preview?: string
    channel_id?: string | null
    document_slug?: string | null
    enqueued_at: string
    // Digest-specific fields (set by compile_digest_emails)
    type?: 'digest'
    recipient_email?: string
    frequency?: string
    queue_ids?: string[]
    notifications?: DigestRawNotification[]
  }
  enqueued_at: string
}

/** Raw notification data from SQL compile_digest_emails */
interface DigestRawNotification {
  notification_type: string
  sender_name: string
  sender_avatar_url: string | null
  message_preview: string
  channel_id: string | null
  channel_name: string
  workspace_id: string | null
  workspace_name: string
  workspace_slug: string
  created_at: string
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
    emailLogger.warn('Supabase not configured - pgmq consumer will not start')
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
async function readQueue(): Promise<EmailQueueMessage[]> {
  const client = getClient()
  if (!client) return []

  try {
    const { data, error } = await client.rpc('consume_email_queue', {
      p_batch_size: BATCH_SIZE,
      p_visibility_timeout: VISIBILITY_TIMEOUT
    })

    if (error) {
      emailLogger.error({ error }, 'Failed to read email queue')
      return []
    }

    return (data || []) as EmailQueueMessage[]
  } catch (err) {
    emailLogger.error({ err }, 'Error reading email queue')
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
    const { error } = await client.rpc('ack_email_message', {
      p_msg_id: msgId
    })

    if (error) {
      emailLogger.error({ error, msgId }, 'Failed to ack email message')
      return false
    }

    return true
  } catch (err) {
    emailLogger.error({ err, msgId }, 'Error acking email message')
    return false
  }
}

/**
 * Update email status in Supabase (after processing)
 */
async function updateEmailStatus(
  queueId: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  const client = getClient()
  if (!client) return

  try {
    await client.rpc('update_email_status', {
      p_queue_id: queueId,
      p_status: status,
      p_error_message: errorMessage || null
    })
  } catch (err) {
    emailLogger.error({ err, queueId }, 'Error updating email status')
  }
}

/**
 * Build DigestDocument[] hierarchy from flat notification list.
 * Groups by workspace (document) → channel → notifications.
 */
function buildDigestDocuments(
  notifications: DigestRawNotification[],
  appUrl: string
): DigestDocument[] {
  const workspaceMap = new Map<
    string,
    {
      name: string
      slug: string
      channels: Map<string, { name: string; id: string; notifications: DigestNotification[] }>
    }
  >()

  for (const n of notifications) {
    const wsKey = n.workspace_slug || 'unknown'

    if (!workspaceMap.has(wsKey)) {
      workspaceMap.set(wsKey, {
        name: n.workspace_name || wsKey,
        slug: n.workspace_slug || wsKey,
        channels: new Map()
      })
    }

    const ws = workspaceMap.get(wsKey)!
    const chKey = n.channel_id || 'general'

    if (!ws.channels.has(chKey)) {
      ws.channels.set(chKey, {
        name: n.channel_name || 'General',
        id: n.channel_id || '',
        notifications: []
      })
    }

    ws.channels.get(chKey)!.notifications.push({
      type: n.notification_type as NotificationType,
      sender_name: n.sender_name,
      sender_avatar_url: n.sender_avatar_url || undefined,
      message_preview: n.message_preview,
      action_url: n.channel_id
        ? `${appUrl}/${n.workspace_slug}?chatroom=${n.channel_id}`
        : `${appUrl}/${n.workspace_slug}`,
      created_at: n.created_at
    })
  }

  return Array.from(workspaceMap.values()).map((ws) => ({
    name: ws.name,
    slug: ws.slug,
    url: `${appUrl}/${ws.slug}`,
    channels: Array.from(ws.channels.values()).map(
      (ch): DigestChannel => ({
        name: ch.name,
        id: ch.id,
        url: ch.id ? `${appUrl}/${ws.slug}?chatroom=${ch.id}` : `${appUrl}/${ws.slug}`,
        notifications: ch.notifications
      })
    )
  }))
}

/**
 * Process a compiled digest message from pgmq
 */
async function processDigestMessage(
  msgId: number,
  payload: EmailQueueMessage['payload']
): Promise<boolean> {
  const appUrl = process.env.APP_URL || 'https://docs.plus'

  try {
    const documents = buildDigestDocuments(payload.notifications || [], appUrl)

    const digestPayload: DigestEmailRequest = {
      to: payload.recipient_email!,
      recipient_name: payload.recipient_name || 'User',
      recipient_id: payload.recipient_id!,
      frequency: (payload.frequency as 'daily' | 'weekly') || 'daily',
      documents,
      period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString()
    }

    const jobId = await queueEmail({
      type: 'digest',
      payload: digestPayload,
      created_at: new Date().toISOString()
    })

    if (!jobId) {
      emailLogger.warn({ msgId }, 'Failed to queue digest email job')
      return false
    }

    const acked = await ackMessage(msgId)
    if (!acked) {
      emailLogger.warn({ msgId }, 'Failed to ack digest message - may be reprocessed')
    }

    // Update all queue items as sent (BullMQ will handle actual delivery)
    const queueIds = payload.queue_ids || []
    for (const queueId of queueIds) {
      await updateEmailStatus(queueId, 'sent')
    }

    emailLogger.info(
      {
        msgId,
        jobId,
        to: payload.recipient_email,
        notifications: (payload.notifications || []).length
      },
      'Digest email queued from pgmq'
    )

    metrics.messagesProcessed++
    metrics.lastMessageAt = new Date()
    return true
  } catch (err) {
    emailLogger.error({ err, msgId }, 'Error processing digest queue message')
    metrics.messagesFailed++

    // Mark all queue items as failed
    const queueIds = payload.queue_ids || []
    for (const queueId of queueIds) {
      await updateEmailStatus(queueId, 'failed', String(err))
    }

    return false
  }
}

/**
 * Process a single queue message (notification or digest)
 */
async function processMessage(message: EmailQueueMessage): Promise<boolean> {
  const { msg_id, payload } = message

  // Route digest messages to dedicated handler
  if (payload.type === 'digest') {
    return processDigestMessage(msg_id, payload)
  }

  try {
    // Build email payload for BullMQ worker
    const emailPayload: NotificationEmailRequest = {
      queue_id: payload.queue_id!,
      to: payload.to!,
      recipient_name: payload.recipient_name || '',
      recipient_id: payload.recipient_id || '',
      sender_name: payload.sender_name || 'Someone',
      sender_id: payload.sender_id,
      sender_avatar_url: payload.sender_avatar_url || undefined,
      notification_type: (payload.notification_type as NotificationType) || 'message',
      message_preview: payload.message_preview || '',
      channel_id: payload.channel_id || undefined,
      document_slug: payload.document_slug || undefined
    }

    // Queue to BullMQ for actual email sending
    const jobId = await queueEmail({
      type: 'notification',
      payload: emailPayload,
      created_at: new Date().toISOString()
    })

    if (!jobId) {
      emailLogger.warn({ msgId: msg_id }, 'Failed to queue email job - queue may be unavailable')
      return false
    }

    // Message processed successfully - acknowledge it
    const acked = await ackMessage(msg_id)
    if (!acked) {
      emailLogger.warn({ msgId: msg_id }, 'Failed to ack message - may be reprocessed')
    }

    emailLogger.debug(
      { msgId: msg_id, jobId, to: payload.to, type: payload.notification_type },
      'Email notification queued from pgmq'
    )

    metrics.messagesProcessed++
    metrics.lastMessageAt = new Date()

    return true
  } catch (err) {
    emailLogger.error({ err, msgId: msg_id }, 'Error processing email queue message')
    metrics.messagesFailed++

    // Update status as failed in Supabase
    if (payload.queue_id) {
      await updateEmailStatus(payload.queue_id, 'failed', String(err))
    }

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

    emailLogger.debug({ count: messages.length }, 'Processing email queue batch')

    // Process messages in parallel (with concurrency limit)
    const results = await Promise.allSettled(messages.map((m) => processMessage(m)))

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length
    const failed = results.length - succeeded

    if (failed > 0) {
      emailLogger.warn({ succeeded, failed }, 'Some email queue messages failed')
    }
  } catch (err) {
    emailLogger.error({ err }, 'Error in email queue poll cycle')
  } finally {
    isProcessing = false
  }
}

/**
 * Start the pgmq consumer
 *
 * IMPORTANT: Call this only from hocuspocus-worker, NOT from rest-api.
 */
export function startEmailQueueConsumer(): boolean {
  if (pollInterval) {
    emailLogger.warn('Email queue consumer already running')
    return false
  }

  const client = getClient()
  if (!client) {
    emailLogger.error('Cannot start email queue consumer - Supabase not configured')
    return false
  }

  emailLogger.info(
    {
      pollInterval: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      visibilityTimeout: VISIBILITY_TIMEOUT
    },
    'Starting email queue consumer (pgmq architecture)'
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
export async function stopEmailQueueConsumer(): Promise<void> {
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

  emailLogger.info(
    {
      messagesProcessed: metrics.messagesProcessed,
      messagesFailed: metrics.messagesFailed
    },
    'Email queue consumer stopped'
  )
}

/**
 * Get consumer health metrics
 */
export function getEmailQueueConsumerHealth(): {
  running: boolean
  metrics: typeof metrics
} {
  return {
    running: pollInterval !== null && !isShuttingDown,
    metrics: { ...metrics }
  }
}
