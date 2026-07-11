/**
 * Email Notification pgmq Consumer
 *
 * Polls Supabase pgmq queue for email notification events and processes them.
 *
 * ARCHITECTURE:
 *   Supabase email_queue → pg_cron → pgmq queue → This Consumer → BullMQ → SMTP
 *
 * Poll/ack/metrics/lifecycle live in the shared createPgmqConsumer; this module
 * owns only the email-specific message mapping, status updates, and RPC names.
 *
 * @see docs/NOTIFICATION_ARCHITECTURE_COMPARISON.md
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { config } from '../../config/env'
import type {
  DigestChannel,
  DigestDocument,
  DigestEmailRequest,
  DigestNotification,
  NotificationEmailRequest,
  NotificationType
} from '../../types/email.types'
import { captureUnknown } from '../instrument'
import { emailLogger } from '../logger'
import { createPgmqConsumer, deterministicJobId } from '../pgmqConsumer'
import { queueEmail } from './queue'

const POLL_INTERVAL_MS = 2000 // Poll every 2 seconds
const BATCH_SIZE = 50 // Process up to 50 messages per poll
const VISIBILITY_TIMEOUT = 60 // Seconds before message becomes visible again

interface EmailQueuePayload {
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

/**
 * Update email status in Supabase (after processing)
 */
async function updateEmailStatus(
  client: SupabaseClient,
  queueId: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
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
    channels: Array.from(ws.channels.values()).map((ch): DigestChannel => ({
      name: ch.name,
      id: ch.id,
      url: ch.id ? `${appUrl}/${ws.slug}?chatroom=${ch.id}` : `${appUrl}/${ws.slug}`,
      notifications: ch.notifications
    }))
  }))
}

/**
 * Process a compiled digest message from pgmq.
 * No single business id exists, so the BullMQ jobId is hashed from the recipient,
 * frequency, and the set of queue ids the digest covers.
 */
async function processDigestMessage(
  client: SupabaseClient,
  msgId: number,
  payload: EmailQueuePayload
): Promise<boolean> {
  const appUrl = config.email.appUrl

  try {
    const documents = buildDigestDocuments(payload.notifications || [], appUrl)
    const queueIds = payload.queue_ids || []

    const digestPayload: DigestEmailRequest = {
      to: payload.recipient_email!,
      recipient_name: payload.recipient_name || 'User',
      recipient_id: payload.recipient_id!,
      frequency: (payload.frequency as 'daily' | 'weekly') || 'daily',
      documents,
      period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString()
    }

    const idempotencyJobId = deterministicJobId(
      'digest',
      payload.recipient_id,
      payload.frequency,
      [...queueIds].sort().join(',')
    )

    const jobId = await queueEmail(
      { type: 'digest', payload: digestPayload, created_at: new Date().toISOString() },
      idempotencyJobId
    )

    if (!jobId) {
      emailLogger.warn({ msgId }, 'Failed to queue digest email job')
      return false
    }

    // Per-row updates are independent single-row UPSERTs keyed on distinct
    // queue_ids, so settle them in parallel. Accepted-loss: digests mark 'sent'
    // at enqueue (not post-delivery like notifications) because the BullMQ job
    // payload carries no queue_ids, so a permanently-failed digest stays 'sent'.
    await Promise.all(queueIds.map((queueId) => updateEmailStatus(client, queueId, 'sent')))

    emailLogger.info(
      {
        msgId,
        jobId,
        to: payload.recipient_email,
        notifications: (payload.notifications || []).length
      },
      'Digest email queued from pgmq'
    )
    return true
  } catch (err) {
    emailLogger.error({ err, msgId }, 'Error processing digest queue message')

    // Independent single-row updates; settle the failure marks in parallel.
    await Promise.all(
      (payload.queue_ids || []).map((queueId) =>
        updateEmailStatus(client, queueId, 'failed', String(err))
      )
    )
    return false
  }
}

/**
 * Process a single notification message from pgmq.
 * queue_id (the email_queue row id) is the stable BullMQ jobId.
 */
async function processNotificationMessage(
  client: SupabaseClient,
  msgId: number,
  payload: EmailQueuePayload
): Promise<boolean> {
  try {
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

    const jobId = await queueEmail(
      { type: 'notification', payload: emailPayload, created_at: new Date().toISOString() },
      payload.queue_id ? `email-${payload.queue_id}` : undefined
    )

    if (!jobId) {
      emailLogger.warn({ msgId }, 'Failed to queue email job - queue may be unavailable')
      captureUnknown(new Error('pgmq email: BullMQ enqueue returned null'))
      return false
    }

    emailLogger.debug(
      { msgId, jobId, to: payload.to, type: payload.notification_type },
      'Email notification queued from pgmq'
    )
    return true
  } catch (err) {
    emailLogger.error({ err, msgId }, 'Error processing email queue message')
    captureUnknown(err)

    if (payload.queue_id) {
      await updateEmailStatus(client, payload.queue_id, 'failed', String(err))
    }
    return false
  }
}

const consumer = createPgmqConsumer<EmailQueuePayload>({
  label: 'email',
  logger: emailLogger,
  readRpc: 'consume_email_queue',
  ackRpc: 'ack_email_message',
  pollIntervalMs: POLL_INTERVAL_MS,
  batchSize: BATCH_SIZE,
  visibilityTimeout: VISIBILITY_TIMEOUT,
  processMessage: async (payload, msgId, ctx) => {
    const client = ctx.getClient()
    if (!client) return false
    return payload.type === 'digest'
      ? processDigestMessage(client, msgId, payload)
      : processNotificationMessage(client, msgId, payload)
  }
})

/**
 * Start the pgmq consumer.
 * IMPORTANT: Call this only from hocuspocus-worker, NOT from rest-api.
 */
export function startEmailQueueConsumer(): boolean {
  return consumer.start()
}

export function stopEmailQueueConsumer(): Promise<void> {
  return consumer.stop()
}

export function getEmailQueueConsumerHealth() {
  return consumer.getHealth()
}
