import { find } from 'linkifyjs'

import { isBarePhone } from './phone'

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

/**
 * Distinguish `scheme:opaque` (real URL) from `host:port` (relative ref
 * the browser would mis-resolve). `SCHEME_RE` alone matches both
 * `mailto:foo` and `localhost:3000`; the candidate-scheme check below
 * vetoes the latter.
 */
const hasRealScheme = (raw: string): boolean => {
  if (raw.startsWith('//')) return true
  const m = raw.match(SCHEME_RE)
  if (!m) return false
  if (raw.includes('://')) return true
  const candidate = m[1].toLowerCase()
  if (candidate === 'localhost' || candidate.includes('.')) return false
  return true
}

/**
 * Strict full-string email match. Multi-token inputs like
 * `hello user@example.com` are not bare emails — that's a sentence.
 * The `@` pre-check avoids paying the linkify cost on plain URLs.
 */
const isBareEmail = (
  trimmed: string
): { ok: true; href: string } | { ok: false; href?: undefined } => {
  if (!trimmed.includes('@')) return { ok: false }
  const matches = find(trimmed)
  if (matches.length !== 1) return { ok: false }
  const only = matches[0]
  if (only.type !== 'email' || only.value !== trimmed) return { ok: false }
  return { ok: true, href: only.href }
}

export const DEFAULT_PROTOCOL = 'https' as const

/**
 * Canonicalize a user-supplied href so stored marks point somewhere
 * absolute (bare `google.com` would otherwise resolve against
 * `document.baseURI` at render time). See README → Normalization for
 * the full pipeline order.
 */
export const normalizeHref = (raw: string, defaultProtocol: string = DEFAULT_PROTOCOL): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const phone = isBarePhone(trimmed)
  if (phone.ok) return phone.href

  const email = isBareEmail(trimmed)
  if (email.ok) return email.href

  if (hasRealScheme(trimmed)) return trimmed
  return `${defaultProtocol}://${trimmed}`
}

/**
 * Shape `findLinks` produces (linkifyjs match + our synthetic
 * special-scheme / phone entries). Loosened so linkifyjs types don't
 * leak across the public boundary.
 */
export type LinkifyMatchLike = {
  type: string
  value: string
  href: string
}

/** Canonicalize a linkifyjs match for storage; non-URL matches pass through unchanged. */
export const normalizeLinkifyHref = (
  link: LinkifyMatchLike,
  defaultProtocol: string = DEFAULT_PROTOCOL
): string => {
  return link.type === 'url' ? normalizeHref(link.value, defaultProtocol) : link.href
}
