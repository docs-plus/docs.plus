/**
 * Email Template Helpers
 *
 * Reusable HTML builders used inside eta templates via `it.h.*()`.
 * Each function returns an HTML string safe for raw injection (`<%~ %>`).
 */

import { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './tokens'

// ---------------------------------------------------------------------------
// Avatar (image or initial)
// ---------------------------------------------------------------------------

export function avatar(name: string, avatarUrl?: string, size: number = 40): string {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="${escapeAttr(name)}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 2px solid ${COLORS.white};">`
  }

  const fontSize = Math.floor(size * 0.4)
  const initial = (name || 'U').charAt(0).toUpperCase()
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width: ${size}px; height: ${size}px; border-radius: 50%; background: ${COLORS.primary};">
    <tr>
      <td align="center" valign="middle" style="color: ${COLORS.white}; font-weight: 600; font-size: ${fontSize}px; font-family: Arial, sans-serif;">
        ${initial}
      </td>
    </tr>
  </table>`
}

// ---------------------------------------------------------------------------
// CTA Button
// ---------------------------------------------------------------------------

export function button(
  text: string,
  url: string,
  variant: 'primary' | 'secondary' = 'primary'
): string {
  const bgColor = variant === 'primary' ? COLORS.primary : COLORS.white
  const textColor = variant === 'primary' ? COLORS.white : COLORS.primary
  const border = variant === 'secondary' ? `border: 1px solid ${COLORS.primary};` : ''

  return `<a href="${escapeAttr(url)}" style="display: inline-block; background: ${bgColor}; color: ${textColor}; text-decoration: none; padding: 12px 24px; border-radius: ${RADIUS.md}; font-size: 14px; font-weight: 500; ${border}">${text}</a>`
}

// ---------------------------------------------------------------------------
// VML Button for Outlook (MSO conditional)
// ---------------------------------------------------------------------------

export function msoButton(text: string, url: string, width: number = 200): string {
  return `<!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeAttr(url)}" style="height:44px;v-text-anchor:middle;width:${width}px;" arcsize="18%" fillcolor="${COLORS.primary}" stroke="f">
      <w:anchorlock/>
      <center style="color:${COLORS.white};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${text}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    ${button(text, url)}
    <!--<![endif]-->`
}

// ---------------------------------------------------------------------------
// Notification type icon
// ---------------------------------------------------------------------------

export function notificationIcon(type: string): string {
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

// ---------------------------------------------------------------------------
// Footer links (manage preferences + unsubscribe)
// ---------------------------------------------------------------------------

export interface UnsubscribeLinks {
  unsubscribe_mentions?: string
  unsubscribe_replies?: string
  unsubscribe_reactions?: string
  unsubscribe_digest?: string
  unsubscribe_all?: string
  preferences?: string
}

export function footerLinks(
  unsubscribeLinks?: UnsubscribeLinks,
  notificationType?: string
): string {
  const preferencesUrl = unsubscribeLinks?.preferences || `${APP_URL}/settings/notifications`

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
    <a href="${escapeAttr(preferencesUrl)}" style="color: ${COLORS.primary}; text-decoration: none;">Manage preferences</a>
    <span style="color: ${COLORS.border}; margin: 0 ${SPACING.sm};">|</span>
    <a href="${escapeAttr(unsubscribeUrl)}" style="color: ${COLORS.primary}; text-decoration: none;">${unsubscribeText}</a>
  `
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

export function truncate(text: string, maxLength: number): string {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Bundle all helpers for template injection
// ---------------------------------------------------------------------------

export const templateHelpers = {
  avatar,
  button,
  msoButton,
  notificationIcon,
  footerLinks,
  truncate,
  escapeHtml,
  // tokens available in templates
  COLORS,
  FONT_STACK,
  SPACING,
  RADIUS,
  APP_NAME,
  APP_URL
}

export type TemplateHelpers = typeof templateHelpers
