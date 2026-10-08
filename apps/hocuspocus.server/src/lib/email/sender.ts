import {
  buildDigestEmail,
  buildListUnsubscribeHeaders,
  buildNotificationEmailText,
  type EmailFooter,
  getEmailSubject,
  renderNotificationEmail
} from '@docs.plus/email-templates'

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
import { getServiceRoleClient } from '../supabase'
import type { UnsubscribeAction } from '../unsubscribeToken'
import { signUnsubscribeToken } from '../unsubscribeToken'
import { inlineIdempotencyKey, providerIdempotencyKey } from './jobIdentity'
import { getEmailProvider } from './providers'
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

export async function sendEmailViaProvider(
  data: EmailJobData,
  options: { jobId?: string } = {}
): Promise<EmailResult> {
  const queue_id =
    data.type === 'notification' ? (data.payload as NotificationEmailRequest).queue_id : undefined
  const delivery = config.email.delivery
  if (delivery.status === 'off') {
    return { success: false, skipped: true, error: 'email not configured', queue_id }
  }
  const provider = getEmailProvider()
  if (delivery.status !== 'ready' || !provider) {
    return { success: false, error: 'email config invalid', queue_id }
  }

  const appUrl = config.email.appUrl
  const nowSeconds = jobSeconds(data.created_at)

  try {
    let to: string[]
    let subject: string
    let html: string
    let text: string
    let headers: Record<string, string> = {}
    let userId: string | undefined

    switch (data.type) {
      case 'notification': {
        const payload = data.payload as NotificationEmailRequest
        to = [payload.to]
        userId = payload.recipient_id
        subject = getEmailSubject(payload.notification_type, payload.sender_name)

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
        if (unsub?.oneClick) headers = buildListUnsubscribeHeaders(unsub.oneClick)

        html = renderNotificationEmail({
          recipientName: payload.recipient_name,
          senderName: payload.sender_name,
          notificationType: payload.notification_type,
          messagePreview: payload.message_preview,
          actionUrl,
          senderAvatarUrl: payload.sender_avatar_url,
          documentName: payload.document_name,
          channelName: payload.channel_name,
          footer: unsub?.footer
        })

        text = buildNotificationEmailText({
          recipientName: payload.recipient_name,
          senderName: payload.sender_name,
          notificationType: payload.notification_type,
          messagePreview: payload.message_preview,
          actionUrl,
          documentName: payload.document_name,
          channelName: payload.channel_name,
          footer: unsub?.footer
        })
        break
      }

      case 'digest': {
        const payload = data.payload as DigestEmailRequest
        to = [payload.to]
        userId = payload.recipient_id

        const unsub = userId ? resolveUnsubscribe(userId, 'digest', nowSeconds) : undefined
        if (unsub?.oneClick) headers = buildListUnsubscribeHeaders(unsub.oneClick)

        const digest = buildDigestEmail({
          recipientName: payload.recipient_name,
          frequency: payload.frequency,
          documents: payload.documents,
          periodEnd: payload.period_end,
          footer: unsub?.footer
        })
        subject = digest.subject
        html = digest.html
        text = digest.text
        break
      }

      case 'generic': {
        const payload = data.payload as GenericEmailRequest
        to = payload.to
        subject = payload.subject
        html = payload.html
        text = payload.text || ''
        break
      }

      default:
        return { success: false, error: `Unknown email type: ${data.type}` }
    }

    const sent = await provider.send(
      { from: delivery.from, to, subject, html, text, headers },
      {
        signal: AbortSignal.timeout(15_000),
        idempotencyKey: options.jobId
          ? providerIdempotencyKey(delivery.keyNamespace, options.jobId)
          : inlineIdempotencyKey(delivery.keyNamespace)
      }
    )

    return { success: true, message_id: sent.messageId, queue_id }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    // `{ err }` carries err_code and err_responseCode, which incident-email-broken reads.
    emailLogger.error({ err }, 'Email send failed')

    return { success: false, error, queue_id }
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
    // A delivered mail stays 'sent': a later failure of a sibling mail cannot undo it.
    if (callback.status === 'failed') update = update.neq('status', 'sent')
    const { error } = await update

    if (error) {
      emailLogger.error({ err: error, queueId: callback.queue_id }, 'Failed to update email status')
    }
  } catch (err) {
    emailLogger.error({ err, queueId: callback.queue_id }, 'Error updating email status')
  }
}
