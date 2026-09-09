/**
 * Plain-text twins of the `.eta` bodies. They live beside the HTML they mirror
 * so both surfaces reach one helper rather than a copy, and so the digest count
 * and its plural rule are resolved once instead of once per surface.
 */

import { countDigestItems, getEmailSubject, renderDigestEmail } from './engine'
import {
  changeWindowLine,
  contributorLine,
  digestNotificationsUrl,
  type EmailFooter,
  footerLinksText
} from './helpers'
import type { DigestDocument, DigestFrequency, NotificationType } from './types'

export function buildNotificationEmailText(params: {
  recipientName: string
  senderName: string
  notificationType: NotificationType
  messagePreview: string
  actionUrl: string
  documentName?: string
  channelName?: string
  footer?: EmailFooter
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
${footerLinksText(params.footer)}
`.trim()
}

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

function buildDigestEmailText(params: {
  recipientName: string
  frequency: DigestFrequency
  documents: DigestDocument[]
  periodEnd: string
  items: string
  footer?: EmailFooter
}): string {
  const { recipientName, frequency, documents, periodEnd, items } = params

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

      // Mirrors the HTML block. The count treats one block as one item, so the
      // plaintext must show it or the number and the body disagree. "+N more"
      // is byte-identical on both surfaces.
      const changes = doc.content_changes
      const sectionLines = (changes?.sections ?? []).map((section) => {
        const trail = section.breadcrumb.length ? `${section.breadcrumb.join(' > ')} > ` : ''
        return `    - ${trail}${section.text}: ${section.url}`
      })
      const moreLine = changes?.moreCount ? `    +${changes.moreCount} more` : ''
      // An indented empty string is truthy, so the guard is what keeps the blank
      // line out when the helper declines to name a contributor.
      const contributors = contributorLine(changes?.contributorCount)
      const changedText = changes
        ? [
            `  ${changeWindowLine(changes.since, changes.fromLastLeft, frequency, periodEnd)}`,
            contributors ? `  ${contributors}` : '',
            ...sectionLines,
            moreLine
          ]
            .filter(Boolean)
            .join('\n')
        : ''
      const body = [changedText, channelsText].filter(Boolean).join('\n')
      return `📄 ${doc.name}\n${body}`
    })
    .join('\n\n---\n\n')

  return `
Hi ${recipientName || 'there'},

Here's your ${frequency} digest with ${items}:

${documentsText}

---
View all notifications: ${digestNotificationsUrl(documents)}
${footerLinksText(params.footer)}
`.trim()
}

export interface DigestEmail {
  subject: string
  html: string
  text: string
}

/**
 * The one entry point for a digest. The item count and its plural rule resolve
 * here, so the subject and the two bodies cannot disagree about how much the
 * mail carries, and no caller copies the payload field by field.
 */
export function buildDigestEmail(params: {
  recipientName: string
  frequency: DigestFrequency
  documents: DigestDocument[]
  /** The window's end, so the "ago" phrase matches on both surfaces. */
  periodEnd: string
  footer?: EmailFooter
}): DigestEmail {
  const totalNotifications = countDigestItems(params.documents)
  const items = `${totalNotifications} notification${totalNotifications === 1 ? '' : 's'}`

  return {
    subject: `Your ${params.frequency} digest - ${items}`,
    html: renderDigestEmail({ ...params, totalNotifications }),
    text: buildDigestEmailText({ ...params, items })
  }
}
