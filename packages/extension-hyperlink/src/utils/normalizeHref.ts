import { find } from 'linkifyjs'

import { isBarePhone } from './phone'

/**
 * Canonicalize a user-supplied href so it points somewhere absolute.
 *
 * `<a href="google.com">` is legal HTML but the browser treats it as a
 * relative URL — `anchor.href` (the click target) resolves to
 * `http://<current-origin>/google.com`. Running every user-typed href
 * through this helper at the write boundary keeps the stored mark
 * pointing where the user intended, regardless of the host page.
 *
 * Rules (in order):
 *   1. Trim whitespace; empty → `''` (callers validate non-emptiness).
 *   2. Bare E.164 phone number → `tel:+<digits>` (formatting stripped
 *      per RFC 3966). Mirrors what the autolink path emits for
 *      whitespace-detected phones; covers create-popover input too.
 *   3. Bare email → `mailto:<email>` (matches what the autolink path
 *      already emits for whitespace-detected emails). Required so the
 *      create popover and the markdown input rule don't store
 *      `https://user@example.com` — a syntactically valid URL whose
 *      `user@` is treated as HTTP basic-auth credentials.
 *   4. Already-absolute (`scheme://…`, `//cdn.foo.com`, or a recognized
 *      `scheme:opaque` like `mailto:`) → return unchanged.
 *   5. Otherwise → prepend `<defaultProtocol>://` (`https` by default).
 *
 * The custom-protocol contract (`registerCustomProtocol('mychat')`)
 * still works: any single-token scheme (no dot, not `localhost`, not
 * an IP literal) is trusted as a real scheme. Only host-shaped strings
 * like `localhost:3000` or `mydomain.com:8080` are rejected as
 * pseudo-schemes and re-prefixed.
 */
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

/**
 * Distinguish `scheme:opaque` (real URL) from `host:port` (relative ref
 * the browser would mis-resolve).
 *
 * `SCHEME_RE` alone is too permissive — `localhost:3000` and
 * `mydomain.com:8080` both match it. The disambiguating rule:
 *   - `scheme://...` → always a real URL.
 *   - `scheme:opaque` (no `//`) → real iff the candidate scheme doesn't
 *     look like a hostname (no dot, not `localhost`, not an IP literal).
 *
 * IPv4 already contains dots (caught by the `.` check). IPv6 contains
 * colons inside the literal, which `[a-z][a-z0-9+.-]*` rejects, so it
 * never matches `SCHEME_RE` in the first place.
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
 * True if the entire trimmed input is a single email match.
 *
 * Strict on purpose — multi-token inputs like `hello user@example.com`
 * still embed an email, but the user clearly typed a sentence (or
 * pasted free-form text), not a hyperlink target.
 *
 * Cheap pre-filter (`@` check) avoids paying the linkify cost on the
 * common case where the input is a plain URL.
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
 * Shape we depend on from a linkifyjs match (plus autolink's
 * manually-constructed special-scheme entries, which also set `type`).
 * Loosened to avoid importing linkifyjs types across the public boundary.
 */
export type LinkifyMatchLike = {
  type: string
  value: string
  href: string
}

/**
 * Canonicalize a linkifyjs match for storage.
 *
 * linkifyjs defaults URL matches to `http://…`; we prefer the
 * extension's `defaultProtocol` (https unless overridden) to stay
 * consistent with the create popover and markdown input rule, so URL
 * matches run through `normalizeHref(value, defaultProtocol)`. Non-URL
 * matches (emails → `mailto:`, etc.) already carry a meaningful scheme
 * in `href` and are returned unchanged.
 */
export const normalizeLinkifyHref = (
  link: LinkifyMatchLike,
  defaultProtocol: string = DEFAULT_PROTOCOL
): string => {
  return link.type === 'url' ? normalizeHref(link.value, defaultProtocol) : link.href
}
