/**
 * Email Templates — Plain Text Builders
 *
 * HTML templates have moved to @docs.plus/email-templates (eta engine).
 * This file contains only the plain-text fallback builders which mirror
 * the HTML structure for email clients that don't render HTML.
 */

import { APP_URL, getEmailSubject } from '@docs.plus/email-templates'

import type { DigestDocument, NotificationType } from '../../types/email.types'

// Re-export getEmailSubject so existing barrel (index.ts) stays stable
export { getEmailSubject }

// ============================================================================
// SINGLE NOTIFICATION — PLAIN TEXT
// ============================================================================

export function buildNotificationEmailText(params: {
  recipientName: string
  senderName: string
  notificationType: NotificationType
  messagePreview: string
  actionUrl: string
  documentName?: string
  channelName?: string
}): string {
  const {
    recipientName,
    senderName,
    notificationType,
    messagePreview,
    actionUrl,
    documentName,
    channelName
  } = params
  const subject = getEmailSubject(notificationType, senderName)
  const context = [documentName, channelName ? `#${channelName}` : ''].filter(Boolean).join(' > ')

  return `
Hi ${recipientName || 'there'},

${context ? `In: ${context}\n` : ''}
${subject}

${messagePreview ? `"${messagePreview}"` : ''}

View the message: ${actionUrl}

---
You're receiving this because you have email notifications enabled.
Manage preferences: ${APP_URL}/settings
Unsubscribe: ${APP_URL}/unsubscribe
`.trim()
}

// ============================================================================
// NEW DOCUMENT — PLAIN TEXT
// ============================================================================

export function buildNewDocumentEmailText(params: {
  documentName: string
  documentUrl: string
  creatorName: string
  creatorEmail?: string
  slug: string
  documentId: string
  createdAt: string
}): string {
  const { documentName, documentUrl, creatorName, creatorEmail, slug, documentId, createdAt } =
    params

  return `
New Document Created

Created By: ${creatorName}${creatorEmail ? ` (${creatorEmail})` : ''}

Name: ${documentName}
Slug: ${slug}
Document ID: ${documentId}
Created At: ${createdAt}

View Document: ${documentUrl}

---
This is an automated notification from docs.plus
`.trim()
}

// ============================================================================
// DIGEST — PLAIN TEXT
// ============================================================================

export function buildDigestEmailText(params: {
  recipientName: string
  frequency: 'daily' | 'weekly'
  documents: DigestDocument[]
}): string {
  const { recipientName, frequency, documents } = params

  const totalNotifications = documents.reduce(
    (sum, doc) => sum + doc.channels.reduce((cSum, ch) => cSum + ch.notifications.length, 0),
    0
  )

  const documentsText = documents
    .map((doc) => {
      const channelsText = doc.channels
        .map((channel) => {
          const notificationsText = channel.notifications
            .slice(0, 3)
            .map(
              (n) =>
                `    - ${getEmailSubject(n.type, n.sender_name)}${n.message_preview ? `: "${n.message_preview.substring(0, 50)}..."` : ''}`
            )
            .join('\n')

          const more =
            channel.notifications.length > 3
              ? `\n    ...and ${channel.notifications.length - 3} more`
              : ''

          return `  #${channel.name} (${channel.notifications.length} messages)\n${notificationsText}${more}`
        })
        .join('\n\n')

      return `📄 ${doc.name}\n${channelsText}`
    })
    .join('\n\n---\n\n')

  return `
Hi ${recipientName || 'there'},

Here's your ${frequency} digest with ${totalNotifications} notification${totalNotifications !== 1 ? 's' : ''}:

${documentsText}

---
View all notifications: ${APP_URL}/notifications
Manage preferences: ${APP_URL}/settings
Unsubscribe: ${APP_URL}/unsubscribe
`.trim()
}
