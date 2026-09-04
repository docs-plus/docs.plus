/**
 * Poll/ack/metrics/lifecycle live in the shared createPgmqConsumer; this module
 * owns only the email-specific message mapping, status updates, and RPC names.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { config } from '../../config/env'
import type {
  DigestEmailRequest,
  EmailStatus,
  NotificationEmailRequest,
  NotificationType
} from '../../types/email.types'
import { resolveContentChangeAudience } from '../contentChangeFanout'
import { captureUnknown } from '../instrument'
import { emailLogger } from '../logger'
import { createPgmqConsumer, deterministicJobId } from '../pgmqConsumer'
import { prisma } from '../prisma'
import {
  buildDigestDocuments,
  CONTENT_CHANGE_TYPE,
  type DigestRawNotification,
  filterDigestDocuments,
  normaliseDigestFrequency
} from './digestDocuments'
import { queueEmail } from './queue'

const POLL_INTERVAL_MS = 2000
const BATCH_SIZE = 50
const VISIBILITY_TIMEOUT = 60 // Seconds before message becomes visible again

interface EmailQueuePayload {
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
  // Set by compile_digest_emails; absent on a single-notification payload.
  type?: 'digest'
  recipient_email?: string
  frequency?: string
  queue_ids?: string[]
  notifications?: DigestRawNotification[]
}

async function updateEmailStatus(
  client: SupabaseClient,
  queueId: string,
  status: EmailStatus,
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
 * Supabase cannot decide this: isPrivate, ownerId and deletedAt live in Prisma,
 * and a document can turn private between the carrier insert and the send.
 */
async function readVisibleContentChangeDocuments(
  documentIds: string[],
  recipientId: string
): Promise<{ visible: Set<string>; readFailed: boolean }> {
  if (documentIds.length === 0) return { visible: new Set(), readFailed: false }
  if (!recipientId) return { visible: new Set(), readFailed: false }

  try {
    const rows = await prisma.documentMetadata.findMany({
      where: { documentId: { in: documentIds } },
      select: { documentId: true, isPrivate: true, ownerId: true, deletedAt: true }
    })
    // One home for the audience rule. Re-deriving it here would let the two
    // gates drift, and a privacy rule with two homes is one rule too many.
    const visible = new Set(
      rows
        .filter((r) => {
          const audience = resolveContentChangeAudience(r)
          if (audience.kind === 'all') return true
          return audience.kind === 'owner' && audience.onlyUser === recipientId
        })
        .map((r) => r.documentId)
    )
    return { visible, readFailed: false }
  } catch (err) {
    // Fail closed: a privacy question with no answer must not mail the document.
    emailLogger.error({ err, recipientId }, 'Content-change privacy re-read failed')
    return { visible: new Set(), readFailed: true }
  }
}

/**
 * No single business id exists, so the BullMQ jobId is hashed from the
 * recipient, frequency, and the set of queue ids the digest covers.
 */
async function processDigestMessage(
  client: SupabaseClient,
  msgId: number,
  payload: EmailQueuePayload
): Promise<boolean> {
  const appUrl = config.email.appUrl

  try {
    const built = buildDigestDocuments(payload.notifications || [], appUrl)
    const queueIds = payload.queue_ids || []

    const { visible, readFailed } = await readVisibleContentChangeDocuments(
      built.flatMap((doc) => (doc.content_changes ? [doc.content_changes.document_id] : [])),
      payload.recipient_id || ''
    )
    const documents = filterDigestDocuments(built, visible)

    // A failed re-read is not an answer, so it must not look like one. Writing
    // 'skipped' here acks the message, the carriers stay unread, and the 24-hour
    // dedupe then suppresses the next fan-out. Returning false leaves the rows
    // 'processing' and lets pgmq redeliver once Prisma recovers.
    if (readFailed) {
      emailLogger.warn({ msgId, to: payload.recipient_email }, 'Digest deferred; re-read failed')
      return false
    }

    if (documents.length === 0) {
      // A genuinely empty digest is an answer. Mark it and ack, or pgmq
      // redelivers the same empty digest forever.
      await Promise.all(
        queueIds.map((id) => updateEmailStatus(client, id, 'skipped', 'No digest content'))
      )
      emailLogger.info({ msgId, to: payload.recipient_email }, 'Digest email skipped')
      return true
    }

    const digestPayload: DigestEmailRequest = {
      to: payload.recipient_email!,
      recipient_name: payload.recipient_name || 'User',
      recipient_id: payload.recipient_id!,
      frequency: normaliseDigestFrequency(payload.frequency),
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
    // at enqueue, so a permanently-failed digest stays 'sent'. A row whose
    // document was dropped for privacy is marked 'sent' too — the payload gives
    // no key joining a notification back to its queue id.
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

/** queue_id (the email_queue row id) is the stable BullMQ jobId. */
async function processNotificationMessage(
  client: SupabaseClient,
  msgId: number,
  payload: EmailQueuePayload
): Promise<boolean> {
  // This path reads no Prisma row, so it cannot answer the privacy question a
  // content_change asks. One SQL line keeps carriers out of it, and that line
  // is hand-deployed. Refusing here costs one carrier on a mis-ordered deploy;
  // trusting it would mail a private document to a non-owner.
  if (payload.notification_type === CONTENT_CHANGE_TYPE) {
    await updateEmailStatus(client, payload.queue_id!, 'skipped', 'content_change is digest-only')
    emailLogger.warn({ msgId }, 'Refused a content_change on the immediate path')
    return true
  }

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

/** Call this only from hocuspocus-worker, NOT from rest-api. */
export function startEmailQueueConsumer(): boolean {
  return consumer.start()
}

export function stopEmailQueueConsumer(): Promise<void> {
  return consumer.stop()
}

export function getEmailQueueConsumerHealth() {
  return consumer.getHealth()
}
