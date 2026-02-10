/**
 * Email Templates
 *
 * Unified, cohesive email templates for all notification types.
 * Follows docs.plus design system with clean, responsive HTML.
 *
 * Design Principles:
 * - Consistent color scheme (primary: #1a73e8)
 * - Unified typography and spacing
 * - Email-safe CSS (tables for layout, no flexbox)
 * - Mobile responsive
 * - Hierarchical digest: Document → Channel → Messages
 */

import type { DigestDocument, NotificationType } from '../../types/email.types'

// ============================================================================
// DESIGN TOKENS (from docs.plus design system)
// ============================================================================

const APP_NAME = 'docs.plus'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://docs.plus'

// Colors
const COLORS = {
  primary: '#1a73e8', // docs blue (--color-primary)
  primaryLight: '#e8f0fe', // light blue background
  secondary: '#0f9d7a', // teal-green (--color-secondary)
  text: '#1f2937', // gray-800
  textMuted: '#6b7280', // gray-500
  textLight: '#9ca3af', // gray-400
  border: '#e5e7eb', // gray-200
  borderLight: '#f3f4f6', // gray-100
  background: '#f9fafb', // gray-50
  white: '#ffffff'
}

// Spacing
const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px'
}

// Border radius
const RADIUS = {
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px'
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable subject based on notification type
 */
export function getEmailSubject(type: NotificationType, senderName: string): string {
  const name = senderName || 'Someone'

  switch (type) {
    case 'mention':
      return `${name} mentioned you`
    case 'reply':
      return `${name} replied to your message`
    case 'reaction':
      return `${name} reacted to your message`
    case 'thread_message':
      return `${name} replied in a thread`
    case 'message':
      return `${name} sent a message`
    case 'channel_event':
      return `${name} made an announcement`
    default:
      return 'New notification'
  }
}

/**
 * Get notification type icon (emoji for email compatibility)
 */
function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return '@'
    case 'reply':
      return '↩'
    case 'reaction':
      return '❤'
    case 'thread_message':
      return '💬'
    case 'message':
      return '✉'
    case 'channel_event':
      return '📢'
    default:
      return '•'
  }
}

/**
 * Build avatar HTML (image or initial)
 */
function buildAvatarHtml(name: string, avatarUrl?: string, size: number = 40): string {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="${name}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 2px solid ${COLORS.white};">`
  }

  const fontSize = Math.floor(size * 0.4)
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width: ${size}px; height: ${size}px; border-radius: 50%; background: ${COLORS.primary};">
    <tr>
      <td align="center" valign="middle" style="color: ${COLORS.white}; font-weight: 600; font-size: ${fontSize}px; font-family: Arial, sans-serif;">
        ${(name || 'U').charAt(0).toUpperCase()}
      </td>
    </tr>
  </table>`
}

/**
 * Build CTA button
 */
function buildButton(
  text: string,
  url: string,
  variant: 'primary' | 'secondary' = 'primary'
): string {
  const bgColor = variant === 'primary' ? COLORS.primary : COLORS.white
  const textColor = variant === 'primary' ? COLORS.white : COLORS.primary
  const border = variant === 'secondary' ? `border: 1px solid ${COLORS.primary};` : ''

  return `<a href="${url}" style="display: inline-block; background: ${bgColor}; color: ${textColor}; text-decoration: none; padding: 12px 24px; border-radius: ${RADIUS.md}; font-size: 14px; font-weight: 500; ${border}">${text}</a>`
}

// ============================================================================
// BASE LAYOUT
// ============================================================================

// ============================================================================
// UNSUBSCRIBE LINKS INTERFACE
// ============================================================================

export interface UnsubscribeLinks {
  unsubscribe_mentions?: string
  unsubscribe_replies?: string
  unsubscribe_reactions?: string
  unsubscribe_digest?: string
  unsubscribe_all?: string
  preferences?: string
}

/**
 * Build footer links with unsubscribe URLs
 */
function buildFooterLinks(
  unsubscribeLinks?: UnsubscribeLinks,
  notificationType?: NotificationType
): string {
  const preferencesUrl = unsubscribeLinks?.preferences || `${APP_URL}/settings/notifications`

  // Get the specific unsubscribe link based on notification type
  let specificUnsubscribe: string | undefined
  let unsubscribeText = 'Unsubscribe'

  if (unsubscribeLinks) {
    switch (notificationType) {
      case 'mention':
        specificUnsubscribe = unsubscribeLinks.unsubscribe_mentions
        unsubscribeText = 'Unsubscribe from mentions'
        break
      case 'reply':
        specificUnsubscribe = unsubscribeLinks.unsubscribe_replies
        unsubscribeText = 'Unsubscribe from replies'
        break
      case 'reaction':
        specificUnsubscribe = unsubscribeLinks.unsubscribe_reactions
        unsubscribeText = 'Unsubscribe from reactions'
        break
      default:
        specificUnsubscribe = unsubscribeLinks.unsubscribe_all
        unsubscribeText = 'Unsubscribe from all'
    }
  }

  const unsubscribeUrl = specificUnsubscribe || `${APP_URL}/unsubscribe`

  return `
    <a href="${preferencesUrl}" style="color: ${COLORS.primary}; text-decoration: none;">Manage preferences</a>
    <span style="color: ${COLORS.border}; margin: 0 ${SPACING.sm};">|</span>
    <a href="${unsubscribeUrl}" style="color: ${COLORS.primary}; text-decoration: none;">${unsubscribeText}</a>
  `
}

/**
 * Build List-Unsubscribe headers for RFC 8058 compliance
 * Returns headers object to be merged with email headers
 */
export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  }
}

/**
 * Base email layout wrapper
 */
function baseLayout(content: string, footerLinks: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${APP_NAME}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .content { width: 600px !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="content" width="600" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.white}; border-radius: ${RADIUS.xl}; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background: ${COLORS.primary}; padding: ${SPACING.xl} ${SPACING.xxl}; text-align: center;">
              <h1 style="margin: 0; color: ${COLORS.white}; font-size: 22px; font-weight: 600; letter-spacing: -0.3px;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: ${SPACING.xxl};">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: ${SPACING.xl} ${SPACING.xxl}; border-top: 1px solid ${COLORS.border}; background-color: ${COLORS.background};">
              <p style="margin: 0 0 ${SPACING.sm}; color: ${COLORS.textLight}; font-size: 12px; text-align: center; line-height: 1.5;">
                You're receiving this because you have email notifications enabled.
              </p>
              <p style="margin: 0; color: ${COLORS.textLight}; font-size: 12px; text-align: center;">
                ${footerLinks}
              </p>
            </td>
          </tr>
        </table>

        <!-- Copyright -->
        <p style="margin: ${SPACING.xl} 0 0; color: ${COLORS.textLight}; font-size: 11px; text-align: center;">
          © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ============================================================================
// SINGLE NOTIFICATION EMAIL
// ============================================================================

/**
 * Build notification email HTML
 */
export function buildNotificationEmailHtml(params: {
  recipientName: string
  senderName: string
  notificationType: NotificationType
  messagePreview: string
  actionUrl: string
  senderAvatarUrl?: string
  documentName?: string
  channelName?: string
  unsubscribeLinks?: UnsubscribeLinks
}): string {
  const {
    recipientName,
    senderName,
    notificationType,
    messagePreview,
    actionUrl,
    senderAvatarUrl,
    documentName,
    channelName,
    unsubscribeLinks
  } = params

  const subject = getEmailSubject(notificationType, senderName)
  const avatarHtml = buildAvatarHtml(senderName, senderAvatarUrl, 44)

  // Context breadcrumb (Document > Channel)
  const contextHtml =
    documentName || channelName
      ? `
    <p style="margin: 0 0 ${SPACING.lg}; color: ${COLORS.textMuted}; font-size: 13px;">
      ${documentName ? `<span style="color: ${COLORS.text}; font-weight: 500;">${documentName}</span>` : ''}
      ${documentName && channelName ? ' › ' : ''}
      ${channelName ? `<span>#${channelName}</span>` : ''}
    </p>
  `
      : ''

  const content = `
    <p style="margin: 0 0 ${SPACING.xl}; color: ${COLORS.text}; font-size: 16px; line-height: 1.5;">
      Hi ${recipientName || 'there'},
    </p>

    ${contextHtml}

    <!-- Notification Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.background}; border-radius: ${RADIUS.lg}; border: 1px solid ${COLORS.border};">
      <tr>
        <td style="padding: ${SPACING.xl};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="56" valign="top">
                ${avatarHtml}
              </td>
              <td style="padding-left: ${SPACING.md};" valign="top">
                <p style="margin: 0 0 ${SPACING.xs}; color: ${COLORS.primary}; font-size: 14px; font-weight: 600;">
                  ${subject}
                </p>
                ${
                  messagePreview
                    ? `
                <p style="margin: 0; color: ${COLORS.textMuted}; font-size: 15px; line-height: 1.5;">
                  "${messagePreview.length > 150 ? messagePreview.substring(0, 150) + '...' : messagePreview}"
                </p>
                `
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-top: ${SPACING.xl};">
          ${buildButton('View Message', actionUrl)}
        </td>
      </tr>
    </table>
  `

  const footerLinks = buildFooterLinks(unsubscribeLinks, notificationType)

  return baseLayout(content, footerLinks)
}

/**
 * Build notification email plain text
 */
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
// NEW DOCUMENT NOTIFICATION EMAIL
// ============================================================================

/**
 * Build new document notification email HTML (admin/internal notification)
 */
export function buildNewDocumentEmailHtml(params: {
  documentName: string
  documentUrl: string
  creatorName: string
  creatorEmail?: string
  creatorAvatarUrl?: string
  createdAt: string
  slug: string
  documentId: string
}): string {
  const {
    documentName,
    documentUrl,
    creatorName,
    creatorEmail,
    creatorAvatarUrl,
    createdAt,
    slug,
    documentId
  } = params

  const avatarHtml = buildAvatarHtml(creatorName, creatorAvatarUrl, 48)

  const content = `
    <p style="margin: 0 0 ${SPACING.xl}; color: ${COLORS.text}; font-size: 16px; font-weight: 600;">
      New Document Created
    </p>

    <!-- Creator Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.background}; border-radius: ${RADIUS.lg}; border: 1px solid ${COLORS.border}; margin-bottom: ${SPACING.xl};">
      <tr>
        <td style="padding: ${SPACING.xl};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="60" valign="top">
                ${avatarHtml}
              </td>
              <td style="padding-left: ${SPACING.md};" valign="top">
                <p style="margin: 0 0 ${SPACING.xs}; color: ${COLORS.text}; font-size: 15px; font-weight: 600;">
                  ${creatorName}
                </p>
                ${creatorEmail ? `<p style="margin: 0; color: ${COLORS.textMuted}; font-size: 13px;">${creatorEmail}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Document Details -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${SPACING.xl};">
      <tr>
        <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.text}; font-size: 13px;">Name</strong>
        </td>
        <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textMuted}; font-size: 13px;">
          ${documentName}
        </td>
      </tr>
      <tr>
        <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.text}; font-size: 13px;">Slug</strong>
        </td>
        <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.border};">
          <code style="background: ${COLORS.borderLight}; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: ${COLORS.textMuted};">${slug}</code>
        </td>
      </tr>
      <tr>
        <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.border};">
          <strong style="color: ${COLORS.text}; font-size: 13px;">ID</strong>
        </td>
        <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.border};">
          <code style="background: ${COLORS.borderLight}; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: ${COLORS.textLight};">${documentId}</code>
        </td>
      </tr>
      <tr>
        <td style="padding: ${SPACING.sm} 0;">
          <strong style="color: ${COLORS.text}; font-size: 13px;">Created</strong>
        </td>
        <td style="padding: ${SPACING.sm} 0; color: ${COLORS.textMuted}; font-size: 13px;">
          ${createdAt}
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          ${buildButton('View Document', documentUrl)}
        </td>
      </tr>
    </table>
  `

  const footerLinks = `
    <a href="${APP_URL}" style="color: ${COLORS.primary}; text-decoration: none;">Go to ${APP_NAME}</a>
  `

  return baseLayout(content, footerLinks)
}

/**
 * Build new document notification email plain text
 */
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
This is an automated notification from ${APP_NAME}
`.trim()
}

// ============================================================================
// DIGEST EMAIL (Grouped by Document → Channel)
// ============================================================================

/**
 * Build digest email HTML with Document → Channel → Messages hierarchy
 */
export function buildDigestEmailHtml(params: {
  recipientName: string
  frequency: 'daily' | 'weekly'
  documents: DigestDocument[]
  periodStart: string
  periodEnd: string
  unsubscribeLinks?: UnsubscribeLinks
}): string {
  const { recipientName, frequency, documents, unsubscribeLinks } = params
  const periodLabel = frequency === 'daily' ? 'today' : 'this week'

  // Count total notifications
  const totalNotifications = documents.reduce(
    (sum, doc) => sum + doc.channels.reduce((cSum, ch) => cSum + ch.notifications.length, 0),
    0
  )

  // Build document sections
  const documentsHtml = documents
    .map((doc) => {
      // Build channels within this document
      const channelsHtml = doc.channels
        .map((channel) => {
          // Build notification cards for this channel
          const notificationsHtml = channel.notifications
            .slice(0, 5)
            .map((n) => {
              const icon = getNotificationIcon(n.type)
              const avatarHtml = buildAvatarHtml(n.sender_name, n.sender_avatar_url, 32)

              return `
        <!-- Notification Item -->
        <tr>
          <td style="padding: ${SPACING.sm} 0; border-bottom: 1px solid ${COLORS.borderLight};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  ${avatarHtml}
                </td>
                <td style="padding-left: ${SPACING.sm};" valign="top">
                  <p style="margin: 0; color: ${COLORS.text}; font-size: 13px; font-weight: 500;">
                    <span style="color: ${COLORS.primary};">${icon}</span> ${n.sender_name}
                  </p>
                  ${
                    n.message_preview
                      ? `
                  <p style="margin: ${SPACING.xs} 0 0; color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.4;">
                    ${n.message_preview.substring(0, 80)}${n.message_preview.length > 80 ? '...' : ''}
                  </p>
                  `
                      : ''
                  }
                </td>
                <td width="50" align="right" valign="middle">
                  <a href="${n.action_url}" style="color: ${COLORS.primary}; font-size: 12px; text-decoration: none; font-weight: 500;">View</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
            })
            .join('')

          const moreInChannel =
            channel.notifications.length > 5
              ? `<tr><td style="padding: ${SPACING.sm} 0; color: ${COLORS.textLight}; font-size: 11px; text-align: center;">+${channel.notifications.length - 5} more in this channel</td></tr>`
              : ''

          return `
      <!-- Channel Section -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${SPACING.md};">
        <tr>
          <td style="background-color: ${COLORS.background}; border-radius: ${RADIUS.md}; border: 1px solid ${COLORS.border};">
            <!-- Channel Header -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: ${SPACING.md} ${SPACING.lg}; border-bottom: 1px solid ${COLORS.border};">
                  <a href="${channel.url}" style="color: ${COLORS.text}; font-size: 13px; font-weight: 600; text-decoration: none;">
                    # ${channel.name}
                  </a>
                  <span style="color: ${COLORS.textLight}; font-size: 12px; margin-left: ${SPACING.sm};">
                    ${channel.notifications.length} message${channel.notifications.length !== 1 ? 's' : ''}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Channel Notifications -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: ${SPACING.sm} ${SPACING.lg};">
              ${notificationsHtml}
              ${moreInChannel}
            </table>
          </td>
        </tr>
      </table>`
        })
        .join('')

      return `
    <!-- Document Section -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${SPACING.xl};">
      <!-- Document Header -->
      <tr>
        <td style="padding-bottom: ${SPACING.md};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <a href="${doc.url}" style="color: ${COLORS.text}; font-size: 15px; font-weight: 600; text-decoration: none;">
                  📄 ${doc.name}
                </a>
              </td>
              <td align="right">
                <a href="${doc.url}" style="color: ${COLORS.primary}; font-size: 12px; text-decoration: none;">Open →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Channels -->
      <tr>
        <td>
          ${channelsHtml}
        </td>
      </tr>
    </table>`
    })
    .join('')

  const content = `
    <p style="margin: 0 0 ${SPACING.lg}; color: ${COLORS.text}; font-size: 16px; line-height: 1.5;">
      Hi ${recipientName || 'there'},
    </p>

    <p style="margin: 0 0 ${SPACING.xl}; color: ${COLORS.textMuted}; font-size: 15px; line-height: 1.5;">
      Here's your <strong style="color: ${COLORS.text};">${frequency} digest</strong> with
      <strong style="color: ${COLORS.primary};">${totalNotifications} notification${totalNotifications !== 1 ? 's' : ''}</strong>
      from ${periodLabel}.
    </p>

    <!-- Documents -->
    ${documentsHtml}

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-top: ${SPACING.lg};">
          ${buildButton('View All Notifications', `${APP_URL}/notifications`)}
        </td>
      </tr>
    </table>
  `

  // For digest, use the digest-specific unsubscribe link
  const digestUnsubscribeLinks: UnsubscribeLinks = {
    ...unsubscribeLinks,
    unsubscribe_all: unsubscribeLinks?.unsubscribe_digest || unsubscribeLinks?.unsubscribe_all
  }
  const footerLinks = buildFooterLinks(digestUnsubscribeLinks)

  return baseLayout(content, footerLinks)
}

/**
 * Build digest email plain text
 */
export function buildDigestEmailText(params: {
  recipientName: string
  frequency: 'daily' | 'weekly'
  documents: DigestDocument[]
}): string {
  const { recipientName, frequency, documents } = params

  // Count total
  const totalNotifications = documents.reduce(
    (sum, doc) => sum + doc.channels.reduce((cSum, ch) => cSum + ch.notifications.length, 0),
    0
  )

  // Build text content
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
