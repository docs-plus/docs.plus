export enum LinkType {
  Email = 'email',
  Social = 'social',
  Simple = 'simple',
  Phone = 'phone'
}

export interface LinkMetadata {
  title?: string
  description?: string
  icon?: string
  themeColor?: string
}

export interface LinkItem {
  url: string
  type: LinkType
  metadata?: LinkMetadata
}

// --- Link constants ---

/** Maximum number of links a user can add */
export const MAX_LINKS = 20

/** Minimum digits required for phone number validation */
const MIN_PHONE_DIGITS = 7

// --- Link helpers (pure functions — no side effects) ---

/**
 * Normalize a URL for consistent comparison.
 * Lowercases hostname, ensures protocol, strips trailing slash.
 */
export const normalizeUrl = (url: string): string => {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(withProtocol)
    parsed.hostname = parsed.hostname.toLowerCase()
    // Strip trailing slash from pathname (but keep "/" for root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return url.trim().toLowerCase()
  }
}

/**
 * Extract the bare domain from a URL (no www. prefix, lowercased).
 */
export const extractDomain = (url: string): string | null => {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    return new URL(withProtocol).hostname.replace('www.', '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * Build the correct href for a link based on its type.
 */
export const getFormattedHref = (link: LinkItem): string => {
  switch (link.type) {
    case LinkType.Email:
      return link.url.startsWith('mailto:') ? link.url : `mailto:${link.url}`
    case LinkType.Phone:
      return link.url.startsWith('tel:') ? link.url : `tel:${link.url}`
    default:
      return link.url.startsWith('http') ? link.url : `https://${link.url}`
  }
}

/**
 * Validate and classify a user-input string as a link type.
 */
export const validateLink = (
  url: string,
  isSocialDomain: (domain: string) => boolean
): { valid: boolean; type?: LinkType; error?: string } => {
  const trimmedUrl = url.trim()

  // Phone number detection — require minimum digit count
  const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,}\)?[-.\s]?\d{1,}[-.\s]?\d{1,}$/
  const digitsOnly = trimmedUrl.replace(/\D/g, '')
  if (phoneRegex.test(trimmedUrl.replace(/\s+/g, '')) && digitsOnly.length >= MIN_PHONE_DIGITS) {
    return { valid: true, type: LinkType.Phone }
  }

  // Email detection
  if (/^mailto:/.test(trimmedUrl) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUrl)) {
    return { valid: true, type: LinkType.Email }
  }

  // URL validation
  const domain = extractDomain(trimmedUrl)
  if (domain) {
    const type = isSocialDomain(domain) ? LinkType.Social : LinkType.Simple
    return { valid: true, type }
  }

  return { valid: false, error: 'Invalid URL format!' }
}

/**
 * Build a Google Favicon Service URL for any domain.
 * Always returns a valid, cached PNG — industry-standard approach
 * used by Notion, Raindrop, Arc, etc.
 * Returns undefined for non-URL types (email/phone) or invalid URLs.
 */
export const getGoogleFaviconUrl = (url: string, size: 32 | 64 = 32): string | undefined => {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    const { origin } = new URL(withProtocol)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=${size}`
  } catch {
    return undefined
  }
}

/**
 * Sanitize raw API metadata response into a clean LinkMetadata object.
 * Strips unused fields (socialBanner, socialBannerSize, etc.) and
 * ensures all values are either valid strings or undefined.
 * Falls back icon → favicon for best icon availability.
 */
export const sanitizeMetadata = (raw: Record<string, unknown>): LinkMetadata => {
  const str = (val: unknown): string | undefined =>
    typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined

  return {
    title: str(raw.title),
    description: str(raw.description),
    icon: str(raw.icon) || str(raw.favicon),
    themeColor: str(raw.themeColor)
  }
}

// --- Notification types ---

export interface EmailBounceInfo {
  email: string
  reason: string
  bounced_at: string
}

export interface NotificationPreferences {
  // Push preferences
  push_mentions?: boolean
  push_replies?: boolean
  push_reactions?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone?: string
  // Email preferences
  email_enabled?: boolean
  email_mentions?: boolean
  email_replies?: boolean
  email_reactions?: boolean
  email_frequency?: 'immediate' | 'daily' | 'weekly' | 'never'
  // Bounce info (set by system when hard bounce occurs)
  email_bounce_info?: EmailBounceInfo
}
