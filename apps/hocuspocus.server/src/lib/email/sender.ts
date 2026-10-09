import { randomUUID } from 'node:crypto'

import {
  buildDigestEmail,
  buildListUnsubscribeHeaders,
  buildNotificationEmailText,
  type EmailFooter,
  getEmailSubject,
  renderNotificationEmail
} from '@docs.plus/email-templates'

import type { EmailConfig } from '../../config/email'
import { config } from '../../config/env'
import type {
  DigestEmailRequest,
  EmailJobData,
  EmailResult,
  EmailStatusCallback,
  GenericEmailRequest,
  NotificationEmailRequest,
  NotificationType
} from '../../types/email.types'
import { emailLogger } from '../logger'
import { maskEmail } from '../maskEmail'
import { sanitizePlainText } from '../sanitizePlainText'
import { getServiceRoleClient } from '../supabase'
import type { UnsubscribeAction } from '../unsubscribeToken'
import { signUnsubscribeToken } from '../unsubscribeToken'
import { inlineIdempotencyKey } from './jobIdentity'
import { getEmailProvider } from './providers'
import { type EmailMessage, EmailSendError, type SentEmail } from './providers/types'
import { oneClickUrl, unsubscribeLinkUrl } from './unsubscribeUrls'

/**
 * Which unsubscribe a mail offers. Exhaustive on purpose: adding a notification
 * type must not silently fall through to turning off every email.
 */
const ACTION_FOR_TYPE: Record<NotificationType, UnsubscribeAction> = {
  mention: 'mentions',
  reply: 'replies',
  reaction: 'reactions',
  message: 'all',
  thread_message: 'all',
  channel_event: 'all',
  content_change: 'all'
}

const UNSUBSCRIBE_TEXT: Record<UnsubscribeAction, string> = {
  mentions: 'Unsubscribe from mentions',
  replies: 'Unsubscribe from replies',
  reactions: 'Unsubscribe from reactions',
  digest: 'Unsubscribe from digests',
  all: 'Unsubscribe from all'
}

/**
 * One action, one signature, both URL shapes. The footer label and the header
 * therefore always describe the same scope. A missing secret still sends the
 * mail: blocking every notification on one config slip is worse.
 */
export function resolveUnsubscribe(
  userId: string,
  action: UnsubscribeAction,
  nowSeconds?: number
): { footer: EmailFooter; oneClick?: string } | undefined {
  const secret = config.email.unsubscribeSecret
  if (!secret) {
    emailLogger.error({ userId }, 'EMAIL_UNSUBSCRIBE_SECRET is not set — footer link has no token')
    return undefined
  }
  const appUrl = config.email.appUrl
  const token = signUnsubscribeToken({ userId, action, secret, nowSeconds })
  const apiOrigin = config.app.publicUrl
  return {
    footer: {
      unsubscribeUrl: unsubscribeLinkUrl(appUrl, token),
      unsubscribeText: UNSUBSCRIBE_TEXT[action],
      preferencesUrl: `${appUrl}/#settings?tab=notifications`
    },
    // Absent origin means no header: a dead one tells the client the
    // unsubscribe worked when nothing was written.
    oneClick: apiOrigin ? oneClickUrl(apiOrigin, token) : undefined
  }
}

/** Seconds of the job's own time, so every retry renders the same body. */
const jobSeconds = (createdAt: string): number => {
  const parsed = Date.parse(createdAt)
  return Math.floor((Number.isNaN(parsed) ? Date.now() : parsed) / 1000)
}

/** Below the worker's 60 s lock, so a slow send fails before BullMQ calls the job stalled. */
const EMAIL_SEND_TIMEOUT_MS = 15_000

const SUBJECT_MAX_CHARS = 150

// A user-set name forms part of some subjects, and a control character there
// can split a header line.
const cleanSubject = (subject: string): string => sanitizePlainText(subject, SUBJECT_MAX_CHARS)

/** The worker never starts on `invalid`, but the inline path can still reach it. */
export function readyEmailDelivery(): Extract<EmailConfig, { status: 'ready' }> {
  const delivery = config.email.delivery
  if (delivery.status !== 'ready') {
    throw new EmailSendError('operator', `email_config_${delivery.status}`, 'email is not set up')
  }
  return delivery
}

/** Renders from the job data and its `created_at` only, so a retry sends the same body. */
export function buildEmailMessage(data: EmailJobData): EmailMessage {
  const { from } = readyEmailDelivery()
  const appUrl = config.email.appUrl
  const nowSeconds = jobSeconds(data.created_at)
  const tags = { email_type: data.type }

  switch (data.type) {
    case 'notification': {
      const payload = data.payload as NotificationEmailRequest
      const userId = payload.recipient_id

      let actionUrl: string
      if (payload.action_url) {
        actionUrl = payload.action_url.startsWith('http')
          ? payload.action_url
          : `${appUrl}${payload.action_url}`
      } else if (payload.channel_id) {
        actionUrl = `${appUrl}?chatroom=${payload.channel_id}`
      } else if (payload.document_slug) {
        actionUrl = `${appUrl}/${payload.document_slug}`
      } else {
        actionUrl = appUrl
      }

      const unsub = userId
        ? resolveUnsubscribe(userId, ACTION_FOR_TYPE[payload.notification_type], nowSeconds)
        : undefined

      return {
        from,
        to: [payload.to],
        subject: cleanSubject(getEmailSubject(payload.notification_type, payload.sender_name)),
        html: renderNotificationEmail({
          recipientName: payload.recipient_name,
          senderName: payload.sender_name,
          notificationType: payload.notification_type,
          messagePreview: payload.message_preview,
          actionUrl,
          senderAvatarUrl: payload.sender_avatar_url,
          documentName: payload.document_name,
          channelName: payload.channel_name,
          footer: unsub?.footer
        }),
        text: buildNotificationEmailText({
          recipientName: payload.recipient_name,
          senderName: payload.sender_name,
          notificationType: payload.notification_type,
          messagePreview: payload.message_preview,
          actionUrl,
          documentName: payload.document_name,
          channelName: payload.channel_name,
          footer: unsub?.footer
        }),
        headers: unsub?.oneClick ? buildListUnsubscribeHeaders(unsub.oneClick) : {},
        tags
      }
    }

    case 'digest': {
      const payload = data.payload as DigestEmailRequest
      const userId = payload.recipient_id
      const unsub = userId ? resolveUnsubscribe(userId, 'digest', nowSeconds) : undefined
      const digest = buildDigestEmail({
        recipientName: payload.recipient_name,
        frequency: payload.frequency,
        documents: payload.documents,
        periodEnd: payload.period_end,
        footer: unsub?.footer
      })
      return {
        from,
        to: [payload.to],
        subject: cleanSubject(digest.subject),
        html: digest.html,
        text: digest.text,
        headers: unsub?.oneClick ? buildListUnsubscribeHeaders(unsub.oneClick) : {},
        tags
      }
    }

    case 'generic': {
      const payload = data.payload as GenericEmailRequest
      return {
        from,
        to: payload.to,
        subject: cleanSubject(payload.subject),
        html: payload.html,
        text: payload.text || '',
        replyTo: payload.reply_to,
        tags
      }
    }

    default:
      throw new Error(`Unknown email type: ${String(data.type)}`)
  }
}

/**
 * The one provider call. It owns the deadline and the one log line per send,
 * and rethrows the provider's EmailSendError untouched. The failure line is the
 * only one that carries `err`, so the err_kind alerts count each failure once.
 */
export async function deliverEmail(
  message: EmailMessage,
  { idempotencyKey, jobId }: { idempotencyKey: string; jobId: string }
): Promise<SentEmail> {
  const { keyNamespace } = readyEmailDelivery()
  const provider = getEmailProvider()
  if (!provider) throw new EmailSendError('operator', 'email_config_invalid', 'email is not set up')

  const to = message.to.map(maskEmail).join(',')
  const startedAt = Date.now()
  try {
    const sent = await provider.send(
      { ...message, tags: { ...message.tags, job_id: jobId, ns: keyNamespace } },
      { signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS), idempotencyKey }
    )
    emailLogger.info(
      {
        jobId,
        provider: provider.name,
        messageId: sent.messageId,
        durationMs: Date.now() - startedAt,
        to
      },
      'Email sent'
    )
    return sent
  } catch (err) {
    emailLogger.error(
      { err, jobId, provider: provider.name, durationMs: Date.now() - startedAt, to },
      'Email send failed'
    )
    throw err
  }
}

/**
 * A send with no job: no-Redis mode and the new-document mail. Nothing retries
 * it, so a failure is final and the caller must not send a second time.
 */
export async function sendEmailInline(data: EmailJobData): Promise<EmailResult> {
  const queue_id =
    data.type === 'notification' ? (data.payload as NotificationEmailRequest).queue_id : undefined
  if (config.email.delivery.status === 'off') {
    return { success: false, skipped: true, error: 'email not configured', queue_id }
  }

  const id = randomUUID()
  try {
    const message = buildEmailMessage(data)
    const sent = await deliverEmail(message, {
      jobId: id,
      idempotencyKey: inlineIdempotencyKey(readyEmailDelivery().keyNamespace, id)
    })
    return { success: true, message_id: sent.messageId, queue_id }
  } catch (err) {
    // deliverEmail already logged a provider failure, and `invalid` pages on its own line.
    if (!(err instanceof EmailSendError)) emailLogger.error({ err }, 'Email build failed')
    return { success: false, error: err instanceof Error ? err.message : String(err), queue_id }
  }
}

export async function updateSupabaseEmailStatus(callback: EmailStatusCallback): Promise<void> {
  const supabase = getServiceRoleClient()
  if (!supabase) {
    emailLogger.debug('Supabase not configured - skipping status callback')
    return
  }

  try {
    const updateData: Record<string, any> = { status: callback.status }
    if (callback.sent_at) updateData.sent_at = callback.sent_at
    if (callback.status === 'sent') updateData.error_message = null
    else if (callback.error_message) updateData.error_message = callback.error_message

    let update = supabase.from('email_queue').update(updateData).eq('id', callback.queue_id)
    // A delivered mail stays 'sent'. A sibling's failure, a stale redelivery or
    // a skip cannot undo it, and the filter makes the check atomic per row.
    if (callback.status !== 'sent') update = update.neq('status', 'sent')
    const { error } = await update

    if (error) {
      emailLogger.error({ err: error, queueId: callback.queue_id }, 'Failed to update email status')
    }
  } catch (err) {
    emailLogger.error({ err, queueId: callback.queue_id }, 'Error updating email status')
  }
}
