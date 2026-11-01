import { find } from 'linkifyjs'

import { logger } from './logger'
import { isBarePhone } from './phone'
import { getSpecialUrlInfo } from './specialUrls'

/**
 * Blocked schemes: `javascript:`/`vbscript:` (script), `data:`, `file:`, `blob:`.
 * Twin of hypermultimedia's copy — preflight diffs them byte-for-byte.
 */
export const DANGEROUS_SCHEME_RE = /^\s*(javascript|data|vbscript|file|blob):/i

/**
 * Single XSS gate used at every read/write boundary. Returns `false`
 * for nullish/empty hrefs and any scheme matched by
 * {@link DANGEROUS_SCHEME_RE}. See docs/security.md.
 */
export const isSafeHref = (href: string | null | undefined): href is string => {
  if (typeof href !== 'string' || href.length === 0) return false
  // Test a control-stripped copy. `new URL()` discards ASCII tab/LF/CR and C0
  // controls, so `java\tscript:` navigates as `javascript:`. Embedded controls
  // must not smuggle a dangerous scheme past the regex.
  // eslint-disable-next-line no-control-regex -- matching C0 controls is the point
  return !DANGEROUS_SCHEME_RE.test(href.replace(/[\u0000-\u0020]+/g, ''))
}

/** Web schemes whose host must look like a real domain (TLD / localhost / IP). */
const STANDARD_WEB_SCHEMES = new Set(['http', 'https', 'ftp', 'ftps'])

/** IPv4 dotted quad. Deliberately loose on octet range — we only need a shape check. */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}]+$/

const OPENER_OF: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

/**
 * Drops trailing punctuation, but keeps a closer that an opener in the link
 * balances: `a:x?(hi)).` gives `a:x?(hi)`. One count pass keeps it linear.
 * Module-internal; `findLinks` imports it.
 */
export const stripTrailingPunctuation = (text: string): string => {
  const counts = new Map<string, number>()
  for (const char of text) {
    if ('()[]{}'.includes(char)) counts.set(char, (counts.get(char) ?? 0) + 1)
  }
  let end = text.length
  while (end > 0 && TRAILING_PUNCTUATION_RE.test(text[end - 1])) {
    const char = text[end - 1]
    const opener = OPENER_OF[char]
    if (opener) {
      // The strip never drops an opener, so every opener sits before this closer.
      const closersBefore = (counts.get(char) ?? 0) - 1
      if ((counts.get(opener) ?? 0) > closersBefore) break
      counts.set(char, closersBefore)
    }
    end--
  }
  return text.slice(0, end)
}

export type ValidateURLOptions = {
  customValidator?: (url: string) => boolean
}

/**
 * Catalog membership only (`whatsapp:`, `wa.me`, …) — NOT a security gate,
 * and it says nothing about whether the URL is safe to render. Web schemes
 * (`http(s)`/`ftp(s)`) are checked by `hasPlausibleHost` instead.
 */
const isRecognizedSpecialScheme = (url: string): boolean => {
  return getSpecialUrlInfo(url) !== null
}

/**
 * linkifyjs accepts any `scheme://host`, so `https://googlecom` passes.
 * Web schemes also need a dotted host, `localhost`, or an IP literal.
 */
const hasPlausibleHost = (url: string): boolean => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname
  if (!host) return false
  if (host === 'localhost') return true
  if (IPV4_RE.test(host)) return true
  // `new URL()` strips IPv6 brackets on most engines and leaves the raw
  // `::1`-style string, which contains a colon that can't appear in any
  // real hostname. Cheap and robust enough.
  if (host.includes(':')) return true
  return host.includes('.')
}

/**
 * The linkify match that starts the input and is followed only by trailing
 * punctuation, plus that link's text with the punctuation left out. Linkify
 * drops a leading `//` from the match, so the text keeps it.
 */
const linkifyWhole = (trimmed: string) => {
  const lead = trimmed.startsWith('//') ? 2 : 0
  const link = find(trimmed).find(
    (found) =>
      found.isLink &&
      found.start === lead &&
      trimmed.slice(found.end).replace(TRAILING_PUNCTUATION_RE, '') === ''
  )
  return link ? { link, text: trimmed.slice(0, link.end) } : null
}

/**
 * The link a form should store: the value when it is one whole link, without
 * the trailing punctuation that linkify leaves out (`google.com,` gives
 * `google.com`), or `null` when {@link validateURL} would refuse it.
 */
export const wholeLink = (url: string, options?: ValidateURLOptions): string | null => {
  const trimmed = url.trim()
  if (!trimmed) return null

  // Security floor: dangerous schemes must NEVER pass shape validation,
  // however linkifyjs evolves or whichever custom protocols a host registers.
  // `composeGate` re-checks at the write boundary, but pinning it here makes
  // the create form reject a newly-banned scheme immediately.
  if (!isSafeHref(trimmed)) return null

  try {
    // E.164 phones have no scheme prefix and would otherwise fall
    // through to linkifyjs, which has no phone matcher.
    if (isBarePhone(trimmed).ok) {
      return !options?.customValidator || options.customValidator(trimmed) ? trimmed : null
    }

    // new URL() encodes a raw space, so the catalog check alone would pass a sentence.
    if (/\s/.test(trimmed)) return null

    if (isRecognizedSpecialScheme(trimmed)) {
      const link = linkifyWhole(trimmed)?.text ?? stripTrailingPunctuation(trimmed)
      return !options?.customValidator || options.customValidator(link) ? link : null
    }

    const found = linkifyWhole(trimmed)
    if (!found?.link.href) return null
    if (options?.customValidator && !options.customValidator(found.link.value)) return null

    // linkifyjs waves through anything scheme-shaped — require a plausible
    // host for web schemes so typos like `https://googlecom` are rejected.
    if (isStandardWebScheme(found.link.href) && !hasPlausibleHost(found.link.href)) return null
    return found.text
  } catch (error) {
    logger.error('wholeLink threw', error)
    return null
  }
}

/**
 * Shape-validate a URL: web schemes with a plausible host, app schemes from
 * the `getSpecialUrlInfo` catalog, and bare E.164 phones. The value must be
 * one whole link. Rejects {@link DANGEROUS_SCHEME_RE}. See docs/url-handling.md.
 */
export const validateURL = (url: string, options?: ValidateURLOptions): boolean =>
  wholeLink(url, options) !== null

/** Module-internal; exported for unit tests only. */
export const getURLScheme = (url: string): string | null => {
  if (!url.trim()) return null

  const colonIndex = url.indexOf(':')
  if (colonIndex === -1) return null

  return url.substring(0, colonIndex).toLowerCase()
}

/** http, https, ftp and ftps: the web schemes that must name a plausible host. */
const isStandardWebScheme = (url: string): boolean => {
  const scheme = getURLScheme(url)
  return scheme !== null && STANDARD_WEB_SCHEMES.has(scheme)
}
