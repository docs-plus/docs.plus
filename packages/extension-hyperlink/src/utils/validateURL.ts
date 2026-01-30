import { find } from 'linkifyjs'

import { getSpecialUrlInfo } from './specialUrls'

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
    const links = find(url).filter((link) => link.isLink)
    const validURL = links.filter((link) => {
      if (options?.customValidator) {
        return options.customValidator(link.value)
      }
      return true
    })[0]

    return !!validURL?.href
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
