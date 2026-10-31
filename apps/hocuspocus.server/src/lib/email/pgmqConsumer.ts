/**
 * Poll/ack/metrics/lifecycle live in the shared createPgmqConsumer; this module
 * owns only the email-specific message mapping, status updates, and RPC names.
 */

import { fitDigestDocuments } from '@docs.plus/email-templates'
import type { SupabaseClient } from '@supabase/supabase-js'

import { config } from '../../config/env'
import { createComputeDocumentChanges } from '../../modules/document-changes/domain/computeDocumentChanges'
import type {
  DigestDocument,
  DigestEmailRequest,
  NotificationEmailRequest,
  NotificationType
} from '../../types/email.types'
import { chatLink, type ChatSource } from '../chatLink'
import { captureUnknown } from '../instrument'
import { emailLogger } from '../logger'
import { maskEmail } from '../maskEmail'
import { readPadLinkRows } from '../padLink'
import { createPgmqConsumer, deterministicJobId } from '../pgmqConsumer'
import { prisma } from '../prisma'
import { getOwnerProfiles } from '../profiles'
import { getRedisClient } from '../redis'
import { enrichDigestDocuments } from './digestContentChanges'
import {
  buildDigestDocuments,
  CONTENT_CHANGE_TYPE,
  digestDocumentId,
  type DigestDocumentMeta,
  type DigestRawNotification,
  normaliseDigestFrequency
} from './digestDocuments'
import { readDigestGrouping, readDigestMaxKb } from './digestGrouping'
import {
  decideDigestOutcome,
  parseLastVisitStamp,
  planDigestMails,
  visibleDigestDocuments
} from './digestMessage'
import { queueEmail } from './queue'
import { resolveUnsubscribe, updateSupabaseEmailStatus } from './sender'

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
  /** The exact-case documentId and the message; both absent on a row queued before #647. */
  workspace_id?: string | null
  message_id?: string | null
  enqueued_at: string
  // Set by compile_digest_emails; absent on a single-notification payload.
  type?: 'digest'
  recipient_email?: string
  frequency?: string
  queue_ids?: string[]
  notifications?: DigestRawNotification[]
}

/** Building this only makes closures, so one set for the process is enough. */
const computeDocumentChanges = createComputeDocumentChanges({
  prisma,
  logger: emailLogger,
  getOwnerProfiles
})

interface WorkspaceMemberVisitRow {
  last_connection_closed_at: string | null
}

/**
 * The window starts where the reader left, so it deliberately diverges from the
 * roster's `get_document_members`. That one answers "Last seen", where an
 * arrival is right. Membership lives in Supabase, so Prisma cannot answer this.
 */
async function readDigestLastVisits(
  client: SupabaseClient,
  recipientId: string,
  documentIds: string[]
): Promise<Map<string, Date | null>> {
  const visits = new Map<string, Date | null>()
  if (!recipientId || documentIds.length === 0) return visits

  const { data, error } = await client
    .from('workspace_members')
    .select('workspace_id, last_connection_closed_at')
    .eq('member_id', recipientId)
    // The exact-case documentId. workspace_slug is lower(documentId) and matches nothing here.
    .in('workspace_id', documentIds)
    .is('left_at', null)

  if (error) {
    // No Last left means the frequency window, so a failed read widens the
    // window rather than costing the reader the block.
    emailLogger.warn({ err: error, recipientId }, 'Digest last-visit read failed')
    return visits
  }

  for (const row of (data ?? []) as (WorkspaceMemberVisitRow & { workspace_id: string })[]) {
    visits.set(row.workspace_id, parseLastVisitStamp(row.last_connection_closed_at))
  }
  return visits
}

/**
 * No single business id exists, so the BullMQ jobId is hashed from the recipient,
 * frequency, document and the message's whole queue id list, never one mail's share.
 * A server that settled every id on every mail hashed the same inputs, so a
 * redelivery across the deploy dedupes.
 */
async function processDigestMessage(
  client: SupabaseClient,
  msgId: number,
  payload: EmailQueuePayload
): Promise<boolean> {
  const appUrl = config.email.appUrl

  const now = new Date()
  const frequency = normaliseDigestFrequency(payload.frequency)
  const recipientId = payload.recipient_id || ''
  // Rows a queued mail carries. That mail settles them, so the catch leaves them alone.
  const handedOff = new Set<string>()

  try {
    const notifications = payload.notifications || []
    const queueIds = pgmqQueueIds(payload)

    // One batched read for the whole message, filtered by the audience rule
    // once. The name, every link and the block then read the same answer, so a
    // document the reader cannot open leaves the digest whole.
    let metaById = new Map<string, DigestDocumentMeta>()
    let metaReadFailed = false
    try {
      const ids = [...new Set(notifications.flatMap((n) => digestDocumentId(n) ?? []))]
      metaById = visibleDigestDocuments(await readPadLinkRows(prisma, ids), recipientId)
    } catch (err) {
      emailLogger.error({ err, msgId }, 'Digest metadata read failed')
      metaReadFailed = true
    }

    // Pure and built before compute, so the enrichment fallback below still carries pad links.
    const { documents: built, queueIdsByDocument } = buildDigestDocuments(
      notifications,
      metaById,
      appUrl
    )
    let enriched: DigestDocument[] = built
    try {
      enriched = await enrichDigestDocuments(built, {
        computeChanges: computeDocumentChanges,
        readLastVisits: (reader, documentIds) => readDigestLastVisits(client, reader, documentIds),
        logger: emailLogger,
        appUrl,
        recipientId,
        frequency,
        now,
        retentionDays: config.worker.autosaveRetentionDays
      })
    } catch (err) {
      // The section list is an extra, not the answer to a privacy question, so
      // the digest still sends with the plain "changed since" line.
      emailLogger.warn({ err, msgId }, 'Digest content-change enrichment failed')
      enriched = built
    }

    const outcome = decideDigestOutcome({ documents: enriched, metaReadFailed })

    if (outcome.kind === 'defer') {
      emailLogger.warn(
        { msgId, to: maskEmail(payload.recipient_email) },
        'Digest deferred; metadata read failed'
      )
      return false
    }

    if (outcome.kind === 'skip') {
      await Promise.all(
        queueIds.map((id) =>
          updateSupabaseEmailStatus({
            queue_id: id,
            status: 'skipped',
            error_message: 'No digest content'
          })
        )
      )
      emailLogger.info({ msgId, to: maskEmail(payload.recipient_email) }, 'Digest email skipped')
      return true
    }

    const redis = getRedisClient()
    const [grouping, maxKb] = await Promise.all([readDigestGrouping(redis), readDigestMaxKb(redis)])
    const plan = planDigestMails(outcome.documents, { grouping, queueIds, queueIdsByDocument })
    const maxBytes = maxKb * 1024
    const queueKey = [...queueIds].sort().join(',')
    const footer = recipientId ? resolveUnsubscribe(recipientId, 'digest')?.footer : undefined

    for (const { documents, queueIds: mailQueueIds } of plan.mails) {
      const docKey = documents.map((document) => document.workspace_id).join(',')
      const fitted = fitDigestDocuments(
        {
          recipientName: payload.recipient_name || 'User',
          frequency,
          documents,
          periodEnd: now.toISOString(),
          footer
        },
        maxBytes
      )
      const digestPayload: DigestEmailRequest = {
        to: payload.recipient_email!,
        recipient_name: payload.recipient_name || 'User',
        recipient_id: payload.recipient_id!,
        frequency,
        documents: fitted,
        period_end: now.toISOString(),
        queue_ids: mailQueueIds
      }
      const idempotencyJobId =
        grouping === 'aggregate'
          ? deterministicJobId('digest', payload.recipient_id, payload.frequency, queueKey)
          : deterministicJobId('digest', payload.recipient_id, payload.frequency, docKey, queueKey)
      // Without Redis the send runs inline and settles its rows; its failure is final.
      await queueEmail(
        { type: 'digest', payload: digestPayload, created_at: new Date().toISOString() },
        idempotencyJobId
      )
      for (const id of mailQueueIds) handedOff.add(id)
    }

    // A mailed row stays 'processing' until the email worker hears from the provider.
    // Settled after the loop, so a failed enqueue leaves these rows to the catch.
    await Promise.all(
      plan.leftOver.map((id) =>
        updateSupabaseEmailStatus({
          queue_id: id,
          status: 'skipped',
          error_message: 'Not in any digest mail'
        })
      )
    )
    emailLogger.info(
      {
        msgId,
        grouping,
        mails: plan.mails.length,
        skipped: plan.leftOver.length,
        to: maskEmail(payload.recipient_email),
        notifications: notifications.length
      },
      'Digest email queued from pgmq'
    )
    return true
  } catch (err) {
    emailLogger.error({ err, msgId }, 'Error processing digest queue message')

    // With Redis, a redelivery re-plans and the job ids dedupe the mails already queued.
    await Promise.all(
      pgmqQueueIds(payload)
        .filter((queueId) => !handedOff.has(queueId))
        .map((queueId) =>
          updateSupabaseEmailStatus({
            queue_id: queueId,
            status: 'failed',
            error_message: String(err)
          })
        )
    )
    return false
  }
}

/** A row queued before #647 names only its channel, so the document comes from there. */
async function readChannelSource(
  client: SupabaseClient,
  channelId: string
): Promise<ChatSource | null> {
  const { data, error } = await client
    .from('channels')
    .select('workspace_id')
    .eq('id', channelId)
    .maybeSingle()
  if (error) throw error
  return { documentId: data?.workspace_id ?? null, messageId: null }
}

/** queue_id (the email_queue row id) is the stable BullMQ jobId. */
async function processNotificationMessage(
  client: SupabaseClient,
  msgId: number,
  payload: EmailQueuePayload
): Promise<boolean> {
  // A content_change is digest-only: this chat-shaped mail cannot show a change.
  // One SQL line keeps carriers out of this path, and that line is hand-deployed,
  // so refusing here costs at most one carrier on a mis-ordered deploy.
  if (payload.notification_type === CONTENT_CHANGE_TYPE) {
    await updateSupabaseEmailStatus({
      queue_id: payload.queue_id!,
      status: 'skipped',
      error_message: 'content_change is digest-only'
    })
    emailLogger.warn({ msgId }, 'Refused a content_change on the immediate path')
    return true
  }

  // A failed read is not an answer: leave the row 'processing' so pgmq redelivers.
  let link: Awaited<ReturnType<typeof chatLink.forEmail>>
  try {
    link = await chatLink.forEmail(
      {
        recipient_id: payload.recipient_id || '',
        channel_id: payload.channel_id,
        workspace_id: payload.workspace_id,
        message_id: payload.message_id
      },
      {
        readSource: () => readChannelSource(client, payload.channel_id || ''),
        readPadRow: async (documentId) => (await readPadLinkRows(prisma, [documentId]))[0] ?? null
      },
      config.email.appUrl
    )
  } catch (err) {
    emailLogger.warn({ err, msgId }, 'Email link lookup failed; deferred')
    return false
  }

  if (link.kind === 'leave-out') {
    await updateSupabaseEmailStatus({
      queue_id: payload.queue_id!,
      status: 'skipped',
      error_message: 'Document not openable by the reader'
    })
    emailLogger.info({ msgId }, 'Email skipped; the reader cannot open the document')
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
      action_url: link.url
    }

    // Without Redis the send runs inline and settles its row; its failure is
    // final, so the message is acked and never sent a second time.
    const queued = await queueEmail(
      { type: 'notification', payload: emailPayload, created_at: new Date().toISOString() },
      payload.queue_id ? `email-${payload.queue_id}` : undefined
    )

    emailLogger.debug(
      { msgId, queued, to: maskEmail(payload.to), type: payload.notification_type },
      'Email notification queued from pgmq'
    )
    return true
  } catch (err) {
    emailLogger.error({ err, msgId }, 'Error processing email queue message')
    captureUnknown(err)

    if (payload.queue_id) {
      await updateSupabaseEmailStatus({
        queue_id: payload.queue_id,
        status: 'failed',
        error_message: String(err)
      })
    }
    return false
  }
}

/**
 * An `invalid` config or a worker outage can stop this consumer for days.
 * Mail older than this would tell people about things they already read.
 */
const EMAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000

const pgmqQueueIds = (payload: EmailQueuePayload): string[] => {
  if (payload.type === 'digest') return payload.queue_ids || []
  return payload.queue_id ? [payload.queue_id] : []
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

    // An unparseable time gives NaN, and NaN is never older: it counts as fresh.
    const ageMs = Date.now() - Date.parse(payload.enqueued_at)
    if (ageMs > EMAIL_MAX_AGE_MS) {
      await Promise.all(
        pgmqQueueIds(payload).map((id) =>
          updateSupabaseEmailStatus({ queue_id: id, status: 'skipped', error_message: 'stale' })
        )
      )
      emailLogger.info({ msgId, ageMs, type: payload.type }, 'Stale email message skipped')
      return true
    }

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
