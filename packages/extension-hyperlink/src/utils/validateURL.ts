import { find } from 'linkifyjs'

import { getSpecialUrlInfo } from './specialUrls'

/** Schemes that must never be used as link hrefs (XSS vectors). */
export const DANGEROUS_SCHEME_RE = /^\s*(javascript|data|vbscript):/i

/** Web schemes whose host must look like a real domain (TLD / localhost / IP). */
const STANDARD_WEB_SCHEMES = new Set(['http', 'https', 'ftp', 'ftps'])

/** IPv4 dotted quad. Deliberately loose on octet range — we only need a shape check. */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

type ValidateURLOptions = {
  customValidator?: (url: string) => boolean
}

/**
 * Check if a URL uses a valid special scheme or domain
 * @param url - The URL to check
 * @returns true if the URL uses a recognized special scheme or domain
 */
const isValidSpecialScheme = (url: string): boolean => {
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
 * gate — they're handled by `isValidSpecialScheme`.
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
 * Validates URLs including both standard web URLs and special app/protocol schemes
 *
 * Supports:
 * - Standard web URLs (http, https, ftp)
 * - Email addresses (mailto:)
 * - Phone numbers (tel:, sms:)
 * - App deep links (whatsapp:, discord:, etc.)
 * - Apple app schemes (maps:, music:, etc.)
 * - Development tools (github:, vscode:, etc.)
 * - Domain-based detection (wa.me, t.me, etc.)
 *
 * For http(s)/ftp(s) URLs, the host must also look real — a TLD dot,
 * `localhost`, or an IP literal. This rejects scheme-prefixed typos like
 * `https://googlecom` that linkifyjs alone would accept.
 *
 * @param url - The URL string to validate
 * @param options - Optional configuration
 * @param options.customValidator - Custom validation function to apply additional checks
 * @returns true if the URL is valid, false otherwise
 *
 * @example
 * ```typescript
 * validateURL('https://example.com') // true
 * validateURL('mailto:user@example.com') // true
 * validateURL('tel:+1234567890') // true
 * validateURL('whatsapp://send?text=hello') // true
 * validateURL('wa.me/1234567890') // true
 * validateURL('https://googlecom') // false (no TLD, no localhost, no IP)
 * validateURL('invalid-url') // false
 * ```
 */
export const validateURL = (url: string, options?: ValidateURLOptions): boolean => {
  if (!url.trim()) return false

  try {
    // First check if it's a special scheme URL or recognized domain
    if (isValidSpecialScheme(url)) {
      // Apply custom validator if provided
      if (options?.customValidator) {
        return options.customValidator(url)
      }
      return true
    }

    // For standard URLs, use linkifyjs to validate
    const validURL = find(url).find(
      (link) =>
        link.isLink && (options?.customValidator ? options.customValidator(link.value) : true)
    )

    if (!validURL?.href) return false

    // linkifyjs waves through anything scheme-shaped — require a plausible
    // host for web schemes so typos like `https://googlecom` are rejected.
    const scheme = getUrlScheme(validURL.href)
    if (scheme && STANDARD_WEB_SCHEMES.has(scheme)) {
      return hasPlausibleHost(validURL.href)
    }
    return true
  } catch (error) {
    console.error('URL validation error:', error)
    return false
  }
}

/**
 * Get the scheme/protocol from a URL
 * @param url - The URL to extract scheme from
 * @returns The scheme (e.g., 'https', 'mailto', 'tel') or null if invalid
 *
 * @example
 * ```typescript
 * getUrlScheme('https://example.com') // 'https'
 * getUrlScheme('mailto:user@example.com') // 'mailto'
 * getUrlScheme('invalid') // null
 * ```
 */
export const getUrlScheme = (url: string): string | null => {
  if (!url.trim()) return null

  const colonIndex = url.indexOf(':')
  if (colonIndex === -1) return null

  return url.substring(0, colonIndex).toLowerCase()
}

/**
 * Check if a URL is a special app/protocol scheme (not http/https)
 * @param url - The URL to check
 * @returns true if it's a special scheme, false for standard web URLs
 *
 * @example
 * ```typescript
 * isSpecialSchemeUrl('mailto:user@example.com') // true
 * isSpecialSchemeUrl('https://example.com') // false
 * ```
 */
export const isSpecialSchemeUrl = (url: string): boolean => {
  const scheme = getUrlScheme(url)
  return scheme !== null && !['http', 'https', 'ftp', 'ftps'].includes(scheme)
}
