import { readCappedBody } from '../../../lib/readCappedBody'
import { ICON_HTML_MAX_BYTES, pickIconHref } from './iconLinks'
import { readHead } from './readHead'
import { safeFetch } from './ssrf'
import { BOT_USER_AGENT, type Miss, type RelayedImage } from './types'

export const LINK_METADATA_MOUNT_PATH = '/api/metadata'
export const LINK_ICON_ROUTE = '/icon'
export const LINK_ICON_PATH = `${LINK_METADATA_MOUNT_PATH}${LINK_ICON_ROUTE}`
export const LINK_IMAGE_ROUTE = '/image'
export const LINK_IMAGE_PATH = `${LINK_METADATA_MOUNT_PATH}${LINK_IMAGE_ROUTE}`

export const ICON_MAX_BYTES_DEFAULT = 32768

const MIN_SNIFF_BYTES = 16

/**
 * True only for a bare origin with no explicit port. `new URL` normalizes case,
 * default ports, IPv4 numbers and IDN, so any rewrite fails the compare. That
 * keeps one cache key per site, and the host stays the punycode form.
 */
export const isIconOrigin = (raw: string): boolean => {
  try {
    const url = new URL(raw)
    return url.origin === raw && url.port === ''
  } catch {
    return false
  }
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, i) => bytes[offset + i] === byte)

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const ICO = [0x00, 0x00, 0x01, 0x00] as const
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] as const
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] as const
const JPEG = [0xff, 0xd8, 0xff] as const
const RIFF = [0x52, 0x49, 0x46, 0x46] as const
const WEBP = [0x57, 0x45, 0x42, 0x50] as const

/** The served `Content-Type` comes from these bytes only, never from the upstream header. */
export const sniffImageType = (bytes: Uint8Array): string | null => {
  if (bytes.length < MIN_SNIFF_BYTES) return null
  if (startsWith(bytes, PNG)) return 'image/png'
  if (startsWith(bytes, ICO) && (bytes[4] | (bytes[5] << 8)) > 0) return 'image/x-icon'
  if (startsWith(bytes, GIF87A) || startsWith(bytes, GIF89A)) return 'image/gif'
  if (startsWith(bytes, JPEG)) return 'image/jpeg'
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'image/webp'
  return null
}

// These upstream answers may change soon, so the miss is cached for a short time only.
const isRetryableStatus = (status: number): boolean =>
  status >= 500 || status === 408 || status === 429

const statusMiss = (status: number): Miss => (isRetryableStatus(status) ? 'error' : 'clean')

/**
 * Each hop gets its own controller under the route's one timer. An over-cap read
 * aborts only its own hop, so the icon route's HTML step can still run after it.
 */
const openHop = (url: string, signal: AbortSignal, accept: string) => {
  const hop = new AbortController()
  const response = safeFetch(url, {
    signal: AbortSignal.any([signal, hop.signal]),
    headers: { 'User-Agent': BOT_USER_AGENT, Accept: accept }
  })
  return { hop, response }
}

export const fetchImage = async (
  url: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const { hop, response: pending } = openHop(url, signal, 'image/*')
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    const bytes = await readCappedBody(response, hop, maxBytes)
    const type = bytes && sniffImageType(bytes)
    return type ? { bytes: new Uint8Array(bytes), type } : 'clean'
  } finally {
    hop.abort()
  }
}

export const isMiss = (result: RelayedImage | Miss): result is Miss => typeof result === 'string'

// The page head names the icon when `/favicon.ico` has none, as on notion.so.
const fetchHtmlIcon = async (
  origin: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const { hop, response: pending } = openHop(`${origin}/`, signal, 'text/html')
  let href: string | null
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    const head = new TextDecoder().decode(await readHead(response, hop, ICON_HTML_MAX_BYTES))
    href = pickIconHref(head, response.url || `${origin}/`)
  } finally {
    hop.abort()
  }
  return href ? fetchImage(href, signal, maxBytes) : 'clean'
}

/**
 * `/favicon.ico` first, then the page head. A favicon throw means the origin itself failed,
 * so it propagates and the HTML step never runs. An HTML-step throw counts as 'error', and
 * 'error' beats 'clean', so a retryable failure keeps the short miss header.
 */
export const fetchSiteIcon = async (
  origin: string,
  signal: AbortSignal,
  maxBytes: number
): Promise<RelayedImage | Miss> => {
  const favicon = await fetchImage(`${origin}/favicon.ico`, signal, maxBytes)
  if (!isMiss(favicon)) return favicon
  const fallback = await fetchHtmlIcon(origin, signal, maxBytes).catch((): Miss => 'error')
  if (!isMiss(fallback)) return fallback
  return favicon === 'error' || fallback === 'error' ? 'error' : 'clean'
}
