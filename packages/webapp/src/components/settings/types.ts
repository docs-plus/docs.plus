import type { LinkItem, LinkMetadata } from '@types'
import { LinkType } from '@types'

export type { LinkItem, LinkMetadata }
export { LinkType }

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
