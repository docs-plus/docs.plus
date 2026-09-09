/**
 * Two contracts, and getting one wrong ships escaped markup or unescaped user
 * input in DKIM-signed mail. `avatar`, `button` and `footerLinks` return HTML,
 * so a template injects them raw with `<%~ %>`. Every other member returns
 * plain text and goes through `<%= %>`, which escapes it.
 */

import { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './tokens'

// Every avatar source is user-writable: `users.avatar_url` allows any
// non-whitespace string, and `raw_user_meta_data.avatar_url` is unconstrained.
// An unescaped quote would close `src=` and append attacker markup to a DKIM-signed
// mail. Anything that is not an http(s) URL falls back to initials.
const safeAvatarSrc = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:' ? escapeAttr(value) : undefined
  } catch {
    return undefined
  }
}

export function avatar(name: string, avatarUrl?: string, size: number = 40): string {
  const src = safeAvatarSrc(avatarUrl)
  if (src) {
    return `<img src="${src}" alt="${escapeAttr(name)}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 2px solid ${COLORS.white};">`
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

export function button(
  text: string,
  url: string,
  variant: 'primary' | 'secondary' = 'primary'
): string {
  const bgColor = variant === 'primary' ? COLORS.primary : COLORS.white
  const textColor = variant === 'primary' ? COLORS.white : COLORS.primary
  const border = variant === 'secondary' ? `border: 1px solid ${COLORS.primary};` : ''

  return `<a href="${escapeAttr(url)}" style="display: inline-block; background: ${bgColor}; color: ${textColor}; text-decoration: none; padding: 12px 24px; border-radius: ${RADIUS.md}; font-size: 14px; font-weight: 500; ${border}">${escapeHtml(text)}</a>`
}

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

/**
 * A resolved footer. The label and the URL arrive together, so they cannot
 * describe different scopes. Choosing which action a mail offers is the
 * sender's job, because only the sender knows what kind of mail it is.
 */
export interface EmailFooter {
  unsubscribeUrl: string
  unsubscribeText: string
  preferencesUrl: string
}

// Used when the signing secret is unset. The link carries no token and the
// route rejects it, which the reader can report. A silent omission cannot be.
const UNSIGNED_FOOTER: EmailFooter = {
  unsubscribeUrl: `${APP_URL}/unsubscribe`,
  unsubscribeText: 'Unsubscribe',
  preferencesUrl: `${APP_URL}/#settings?tab=notifications`
}

export function footerLinks(footer: EmailFooter = UNSIGNED_FOOTER): string {
  return `
    <a href="${escapeAttr(footer.preferencesUrl)}" style="color: ${COLORS.primary}; text-decoration: none;">Manage preferences</a>
    <span style="color: ${COLORS.border}; margin: 0 ${SPACING.sm};">|</span>
    <a href="${escapeAttr(footer.unsubscribeUrl)}" style="color: ${COLORS.primary}; text-decoration: none;">${footer.unsubscribeText}</a>
  `
}

/** The plain-text twin. Both parts of one mail must offer the same link. */
export function footerLinksText(footer: EmailFooter = UNSIGNED_FOOTER): string {
  return `Manage preferences: ${footer.preferencesUrl}\n${footer.unsubscribeText}: ${footer.unsubscribeUrl}`
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function formatAgo(startedAt: number, now: number): string {
  const elapsed = now - startedAt
  if (elapsed < 2 * MINUTE_MS) return 'just now'
  if (elapsed < HOUR_MS) return `${Math.max(2, Math.round(elapsed / MINUTE_MS))} minutes ago`
  if (elapsed < DAY_MS) {
    const hours = Math.round(elapsed / HOUR_MS)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  if (elapsed < 7 * DAY_MS) {
    const days = Math.round(elapsed / DAY_MS)
    return days === 1 ? '1 day ago' : `${days} days ago`
  }
  return `on ${new Date(startedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })}`
}

/**
 * The window starts at Last left, so it is often minutes and a bare date read as
 * broken. One home for both surfaces: `digest.eta` reaches it through `it.h`,
 * and `templates.ts` calls it directly, so the two lines cannot drift.
 */
export function changeWindowLine(
  since: string,
  fromLastLeft: boolean,
  frequency: 'daily' | 'weekly',
  now?: number | string
): string {
  const startedAt = Date.parse(since)
  // A carrier timestamp can be unparseable, and the seed keeps it on purpose,
  // so "NaN minutes ago" would ship. The frequency line reads no `since`.
  if (!fromLastLeft || Number.isNaN(startedAt)) {
    return frequency === 'weekly' ? '✏️ Changed in the last week.' : '✏️ Changed in the last day.'
  }
  // Anchor on the window's own end, which both surfaces pass as `periodEnd`. A
  // digest renders from a queued payload, so wall clock at render can sit well
  // past the instant the sections were computed for, and the two would disagree.
  const anchor = typeof now === 'string' ? Date.parse(now) : now
  const endedAt = anchor === undefined || Number.isNaN(anchor) ? Date.now() : anchor
  return `✏️ Changed since you left, ${formatAgo(startedAt, endedAt)}.`
}

/**
 * A floor, never a census: `Documents.contributors` is per replica and editor
 * only. One home for both surfaces, the way `changeWindowLine` already works,
 * so the HTML line and the plaintext line cannot drift.
 */
export function contributorLine(count?: number): string {
  if (!count || count < 1) return ''
  return count === 1 ? '👤 1 person contributed.' : `👥 ${count} people contributed.`
}

/**
 * The notification panel is user scoped, so the first document shows all of it.
 * A pad url can carry `?chatroom=…` or a fragment of its own, so drop any
 * fragment and append this one. `${APP_URL}/notifications` was never a route.
 * One home for both surfaces, so the HTML button and the plaintext line agree.
 */
export function digestNotificationsUrl(documents: ReadonlyArray<{ url: string }>): string {
  const first = documents[0]?.url
  if (!first) return APP_URL
  return `${first.split('#')[0]}#notifications`
}

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

/** Only what a `.eta` reaches through `it.h`. Package-internal callers import directly. */
export const templateHelpers = {
  avatar,
  button,
  notificationIcon,
  footerLinks,
  footerLinksText,
  changeWindowLine,
  contributorLine,
  truncate,
  COLORS,
  FONT_STACK,
  SPACING,
  RADIUS,
  APP_NAME,
  APP_URL
}

export type TemplateHelpers = typeof templateHelpers
