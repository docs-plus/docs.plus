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

/** Module-internal; `findLinks` imports it. Not in the public barrel. */
export const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}]+$/

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
 * Shape-validate a URL: web schemes with a plausible host, app schemes from
 * the `getSpecialUrlInfo` catalog, and bare E.164 phones. The value must be
 * one whole link. Rejects {@link DANGEROUS_SCHEME_RE}. See docs/url-handling.md.
 */
export const validateURL = (url: string, options?: ValidateURLOptions): boolean => {
  const trimmed = url.trim()
  if (!trimmed) return false

  // Security floor: dangerous schemes must NEVER pass shape validation,
  // however linkifyjs evolves or whichever custom protocols a host registers.
  // `composeGate` re-checks at the write boundary, but pinning it here makes
  // the create form reject a newly-banned scheme immediately.
  if (!isSafeHref(trimmed)) return false

  try {
    // E.164 phones have no scheme prefix and would otherwise fall
    // through to linkifyjs, which has no phone matcher.
    if (isBarePhone(trimmed).ok) {
      if (options?.customValidator) return options.customValidator(url)
      return true
    }

    // new URL() encodes a raw space, so the catalog check alone would pass a sentence.
    if (/\s/.test(trimmed)) return false

    if (isRecognizedSpecialScheme(url)) {
      if (options?.customValidator) return options.customValidator(url)
      return true
    }

    // The found link must start the input and only trailing punctuation may
    // follow; linkify drops a leading `//`.
    const lead = trimmed.startsWith('//') ? 2 : 0
    const validURL = find(trimmed).find(
      (link) =>
        link.isLink &&
        link.start === lead &&
        trimmed.slice(link.end).replace(TRAILING_PUNCTUATION_RE, '') === ''
    )
    if (!validURL?.href) return false
    if (options?.customValidator && !options.customValidator(validURL.value)) return false

    // linkifyjs waves through anything scheme-shaped — require a plausible
    // host for web schemes so typos like `https://googlecom` are rejected.
    if (isStandardWebScheme(validURL.href)) {
      return hasPlausibleHost(validURL.href)
    }
    return true
  } catch (error) {
    logger.error('validateURL threw', error)
    return false
  }
}

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
