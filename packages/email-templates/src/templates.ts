/**
 * Plain-text twins of the `.eta` bodies. They live beside the HTML they mirror
 * so both surfaces reach one helper rather than a copy, and so the digest count
 * and its plural rule are resolved once instead of once per surface.
 */

import { type DigestBlock, walkDigest } from './digestWalk'
import { countDigestItems, getEmailSubject, renderDigestEmail } from './engine'
import { digestNotificationsUrl, type EmailFooter, footerLinksText, runText } from './helpers'
import type { DigestChangeRun, DigestDocument, DigestFrequency, NotificationType } from './types'

// Plain text has no colour, so markers keep removed and added words apart.
function paintRuns(runs: readonly DigestChangeRun[]): string {
  const text = runs
    .map((run) =>
      run.kind === 'removed'
        ? `[-${run.text}-]`
        : run.kind === 'added'
          ? `{+${run.text}+}`
          : runText(run)
    )
    .join('')
  return text ? `\n      ${text}` : ''
}

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

function paintDigestBlock(block: DigestBlock): string {
  switch (block.kind) {
    case 'sheet':
      return `${block.name}\n${block.url}`
    case 'heading':
      return `    ${block.text}\n      ${block.url}`
    case 'notice':
      return `      ${block.notice.sender_name}: ${block.notice.message_preview}\n      ${block.notice.action_url}`
    case 'runs':
      return `      ${paintRuns(block.runs)}`
    case 'more':
      return `      +${block.count} more in this channel`
    case 'status':
      return block.line ? `  ${block.line}` : ''
    case 'home':
      return block.url
    default: {
      const unseen: never = block
      return unseen
    }
  }
}

function buildDigestEmailText(blocks: readonly DigestBlock[], footer?: EmailFooter): string {
  const body = blocks.map(paintDigestBlock).filter(Boolean).join('\n')
  return `${body}\n---\n${footerLinksText(footer)}`.trim()
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
  const blocks = walkDigest({
    documents: params.documents,
    frequency: params.frequency,
    periodEnd: params.periodEnd,
    recipientName: params.recipientName,
    totalNotifications,
    notificationsUrl: digestNotificationsUrl(params.documents)
  })

  return {
    subject: `Your ${params.frequency} digest - ${items}`,
    html: renderDigestEmail({ blocks, footer: params.footer }),
    text: buildDigestEmailText(blocks, params.footer)
  }
}
