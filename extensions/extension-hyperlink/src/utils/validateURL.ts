import { find } from 'linkifyjs'

import { logger } from './logger'
import { isBarePhone } from './phone'
import { getSpecialUrlInfo } from './specialUrls'

/**
 * Schemes blocked at every write boundary: `javascript:` / `vbscript:`
 * (script execution), `data:` (arbitrary HTML), `file:` (local FS),
 * `blob:` (in-page memory; never legitimate in stored content).
 */
export const DANGEROUS_SCHEME_RE = /^\s*(javascript|data|vbscript|file|blob):/i

/**
 * Single XSS gate used at every read/write boundary. Returns `false`
 * for nullish/empty hrefs and any scheme matched by
 * {@link DANGEROUS_SCHEME_RE}. See README → Security.
 */
export const isSafeHref = (href: string | null | undefined): href is string => {
  if (typeof href !== 'string' || href.length === 0) return false
  return !DANGEROUS_SCHEME_RE.test(href)
}

/** Web schemes whose host must look like a real domain (TLD / localhost / IP). */
const STANDARD_WEB_SCHEMES = new Set(['http', 'https', 'ftp', 'ftps'])

/** IPv4 dotted quad. Deliberately loose on octet range — we only need a shape check. */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

type ValidateURLOptions = {
  customValidator?: (url: string) => boolean
}

/**
 * Whether `url` matches an entry in the `getSpecialUrlInfo` catalog —
 * an app deep-link scheme (`whatsapp:`, `vscode:`, …) or a domain
 * mapping (`wa.me`, `t.me`, …). Catalog membership only; this is NOT
 * a security gate and says nothing about whether the URL is safe to
 * render. Web schemes (`http(s)`/`ftp(s)`) are checked separately by
 * `hasPlausibleHost` further down.
 */
const isRecognizedSpecialScheme = (url: string): boolean => {
  return getSpecialUrlInfo(url) !== null
}

/**
 * Is the host of this URL plausible enough to store as a hyperlink?
 *
 * linkifyjs accepts any `scheme://host` string, so typos like
 * `https://googlecom` or `https://asdf` pass its own validation. For
 * http(s)/ftp we additionally require that the host has either:
 *   - a dot (any TLD — works for IDN and punycode), or
 *   - equals `localhost` (legitimate dev host), or
 *   - looks like an IPv4 or IPv6 literal.
 *
 * Non-standard schemes (mailto, tel, whatsapp, …) don't go through this
 * gate — they're handled by `isRecognizedSpecialScheme`.
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
 * Shape-validate a URL. Accepts web schemes (with a plausible host —
 * TLD dot, `localhost`, IP literal), special app/protocol schemes from
 * the `getSpecialUrlInfo` catalog, and bare E.164 phone numbers.
 * Rejects schemes matched by {@link DANGEROUS_SCHEME_RE}. See README →
 * Validation for the full policy.
 */
export const validateURL = (url: string, options?: ValidateURLOptions): boolean => {
  const trimmed = url.trim()
  if (!trimmed) return false

  // Defense-in-depth security floor: dangerous schemes must NEVER pass
  // shape validation, regardless of how linkifyjs evolves or which
  // custom protocols a host has registered. The write-boundary command
  // (`buildHrefGate`) re-checks `isSafeHref`, but pinning it here keeps
  // popover UX in lockstep with the security policy — a future scheme
  // added to `DANGEROUS_SCHEME_RE` will be rejected by the create form
  // immediately, not silently passed through to a downstream gate.
  if (!isSafeHref(trimmed)) return false

  try {
    // E.164 phones have no scheme prefix and would otherwise fall
    // through to linkifyjs, which has no phone matcher.
    if (isBarePhone(trimmed).ok) {
      if (options?.customValidator) return options.customValidator(url)
      return true
    }

    if (isRecognizedSpecialScheme(url)) {
      if (options?.customValidator) return options.customValidator(url)
      return true
    }

    const validURL = find(url).find(
      (link) =>
        link.isLink && (options?.customValidator ? options.customValidator(link.value) : true)
    )
    if (!validURL?.href) return false

    // linkifyjs waves through anything scheme-shaped — require a plausible
    // host for web schemes so typos like `https://googlecom` are rejected.
    const scheme = getURLScheme(validURL.href)
    if (scheme && STANDARD_WEB_SCHEMES.has(scheme)) {
      return hasPlausibleHost(validURL.href)
    }
    return true
  } catch (error) {
    logger.error('validateURL threw', error)
    return false
  }
}

/** Lowercased scheme component of `url`, or `null` if it has no `:`. Module-internal; exported for unit tests only. */
export const getURLScheme = (url: string): string | null => {
  if (!url.trim()) return null

  const colonIndex = url.indexOf(':')
  if (colonIndex === -1) return null

  return url.substring(0, colonIndex).toLowerCase()
}
