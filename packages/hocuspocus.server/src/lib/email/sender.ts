/**
 * Email Sender
 *
 * Transforms EmailJobData into provider-ready messages.
 * Handles template rendering and Supabase status callbacks.
 * Includes RFC 8058 List-Unsubscribe headers for one-click unsubscribe.
 */

import { createClient } from '@supabase/supabase-js'

import type {
  DigestEmailRequest,
  EmailJobData,
  EmailResult,
  EmailStatusCallback,
  GenericEmailRequest,
  NotificationEmailRequest} from '../../types/email.types'
import { emailLogger } from '../logger'
import { sendEmail } from './providers'
import {
  buildDigestEmailHtml,
  buildDigestEmailText,
  buildListUnsubscribeHeaders,
  buildNotificationEmailHtml,
  buildNotificationEmailText,
  getEmailSubject,
  type UnsubscribeLinks
} from './templates'

/**
 * Fetch unsubscribe links from Supabase for a user
 */
async function getUnsubscribeLinks(userId: string): Promise<UnsubscribeLinks | undefined> {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return undefined
  }

  try {
    const supabase = createClient(url, serviceKey)
    const appUrl = process.env.APP_URL || 'https://docs.plus'

    const { data, error } = await supabase.rpc('get_email_footer_links', {
      p_user_id: userId,
      p_base_url: appUrl
    })

    if (error) {
      emailLogger.warn({ err: error, userId }, 'Failed to fetch unsubscribe links')
      return undefined
    }

    return data as UnsubscribeLinks
  } catch (err) {
    emailLogger.warn({ err }, 'Error fetching unsubscribe links')
    return undefined
  }
}

/**
 * Send email using the configured provider
 * Includes RFC 8058 List-Unsubscribe headers for one-click unsubscribe
 */
export async function sendEmailViaProvider(data: EmailJobData): Promise<EmailResult> {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@docs.plus'
  const appUrl = process.env.APP_URL || 'https://docs.plus'

  try {
    let to: string
    let subject: string
    let html: string
    let text: string
    let headers: Record<string, string> = {}
    let userId: string | undefined

    switch (data.type) {
      case 'notification': {
        const payload = data.payload as NotificationEmailRequest
        to = payload.to
        userId = payload.recipient_id
        subject = getEmailSubject(payload.notification_type, payload.sender_name)

        const actionUrl = payload.action_url
          ? payload.action_url.startsWith('http')
            ? payload.action_url
            : `${appUrl}${payload.action_url}`
          : payload.channel_id
            ? `${appUrl}?chatroom=${payload.channel_id}`
            : payload.document_slug
              ? `${appUrl}/${payload.document_slug}`
              : appUrl

        // Fetch unsubscribe links for this user
        const unsubscribeLinks = userId ? await getUnsubscribeLinks(userId) : undefined

        // Build List-Unsubscribe headers (RFC 8058)
        if (unsubscribeLinks?.unsubscribe_all) {
          headers = buildListUnsubscribeHeaders(unsubscribeLinks.unsubscribe_all)
        }

        html = buildNotificationEmailHtml({
          recipientName: payload.recipient_name,
          senderName: payload.sender_name,
          notificationType: payload.notification_type,
          messagePreview: payload.message_preview,
          actionUrl,
          senderAvatarUrl: payload.sender_avatar_url,
          documentName: payload.document_name,
          channelName: payload.channel_name,
          unsubscribeLinks
        })

        text = buildNotificationEmailText({
          recipientName: payload.recipient_name,
          senderName: payload.sender_name,
          notificationType: payload.notification_type,
          messagePreview: payload.message_preview,
          actionUrl,
          documentName: payload.document_name,
          channelName: payload.channel_name
        })
        break
      }

      case 'digest': {
        const payload = data.payload as DigestEmailRequest
        to = payload.to
        userId = payload.recipient_id

        const totalNotifications = payload.documents.reduce(
          (sum, doc) => sum + doc.channels.reduce((cSum, ch) => cSum + ch.notifications.length, 0),
          0
        )

        subject = `Your ${payload.frequency} digest - ${totalNotifications} notification${totalNotifications !== 1 ? 's' : ''}`

        // Fetch unsubscribe links for this user
        const unsubscribeLinks = userId ? await getUnsubscribeLinks(userId) : undefined

        // Build List-Unsubscribe headers (RFC 8058) - use digest-specific link
        if (unsubscribeLinks?.unsubscribe_digest) {
          headers = buildListUnsubscribeHeaders(unsubscribeLinks.unsubscribe_digest)
        } else if (unsubscribeLinks?.unsubscribe_all) {
          headers = buildListUnsubscribeHeaders(unsubscribeLinks.unsubscribe_all)
        }

        html = buildDigestEmailHtml({
          recipientName: payload.recipient_name,
          frequency: payload.frequency,
          documents: payload.documents,
          periodStart: payload.period_start,
          periodEnd: payload.period_end,
          unsubscribeLinks
        })

        text = buildDigestEmailText({
          recipientName: payload.recipient_name,
          frequency: payload.frequency,
          documents: payload.documents
        })
        break
      }

      case 'generic': {
        const payload = data.payload as GenericEmailRequest
        to = payload.to.join(', ')
        subject = payload.subject
        html = payload.html
        text = payload.text || ''
        break
      }

      default:
        return { success: false, error: `Unknown email type: ${data.type}` }
    }

    const result = await sendEmail({ from: fromEmail, to, subject, html, text, headers })

    return {
      success: result.success,
      message_id: result.messageId,
      error: result.error,
      queue_id:
        data.type === 'notification'
          ? (data.payload as NotificationEmailRequest).queue_id
          : undefined
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    emailLogger.error({ err }, 'Email send failed')

    return {
      success: false,
      error,
      queue_id:
        data.type === 'notification'
          ? (data.payload as NotificationEmailRequest).queue_id
          : undefined
    }
  }
}

/**
 * Update email status in Supabase email_queue table
 */
export async function updateSupabaseEmailStatus(callback: EmailStatusCallback): Promise<void> {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    emailLogger.debug('Supabase not configured - skipping status callback')
    return
  }

  try {
    const supabase = createClient(url, serviceKey)
    const updateData: Record<string, any> = { status: callback.status }
    if (callback.sent_at) updateData.sent_at = callback.sent_at
    if (callback.error_message) updateData.error_message = callback.error_message

    const { error } = await supabase
      .from('email_queue')
      .update(updateData)
      .eq('id', callback.queue_id)

    if (error) {
      emailLogger.error({ err: error, queueId: callback.queue_id }, 'Failed to update email status')
    }
  } catch (err) {
    emailLogger.error({ err }, 'Error updating email status')
  }
}
