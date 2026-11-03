import { normalizeHref } from '@docs.plus/extension-hyperlink'
import { apiBaseUrl } from '@utils/apiBaseUrl'
import { isWebHref } from '@utils/link-helpers'

import type { LinkCard } from './types'

interface MetadataResponse {
  success: true
  url: string
  title: string
  description?: string
  image?: { url: string }
}

interface ErrorResponse {
  success: false
}

type ApiResponse = MetadataResponse | ErrorResponse

interface CacheEntry {
  data: LinkCard | null
  expiresAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15_000
const sessionCache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<LinkCard | null>>()

/**
 * One string is both the cache key and the `?url=` value. The fragment never changes the
 * page, so it is dropped. `null` means the server cannot fetch it (mailto:, tel:, app schemes).
 */
const metadataKey = (href: string): string | null => {
  try {
    const url = new URL(normalizeHref(href))
    if (!isWebHref(url)) return null
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

const readEntry = (key: string): LinkCard | null | undefined => {
  const entry = sessionCache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(key)
    return undefined
  }
  return entry.data
}

const remember = (key: string, data: LinkCard | null): LinkCard | null => {
  sessionCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}

/** `undefined` = not loaded yet, `null` = no card for this href, data = hit. Never fetches. */
export const getCachedMetadata = (href: string): LinkCard | null | undefined => {
  const key = metadataKey(href)
  return key === null ? null : readEntry(key)
}

/**
 * The page image goes through our server, so the linked site never sees the reader. The
 * server keeps only http(s) image URLs. Field by field, so the raw image URL is never kept.
 */
const toLinkCard = (key: string, data: MetadataResponse): LinkCard => ({
  url: data.url,
  title: data.title,
  description: data.description,
  image: data.image?.url
    ? { url: `${apiBaseUrl()}/metadata/image?url=${encodeURIComponent(key)}` }
    : undefined
})

/**
 * Only a 400 or a `success: false` body is cached as null: those answers will not change.
 * A 429, a 5xx (Traefik can send 502/503), a timeout or a network error is not cached,
 * so the next open asks again.
 */
const request = async (key: string): Promise<LinkCard | null> => {
  try {
    const response = await fetch(`${apiBaseUrl()}/metadata?url=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (response.status === 400) return remember(key, null)
    if (!response.ok) {
      console.error('Metadata API error:', response.status, response.statusText)
      return null
    }
    const data: ApiResponse = await response.json()
    return remember(key, data.success ? toLinkCard(key, data) : null)
  } catch (error) {
    console.error('Error fetching metadata:', error)
    return null
  }
}

/**
 * Callers of one URL share one request, and none of them can abort it. So a hover that
 * leaves still fills the cache for the click that follows. Each caller drops its own late result.
 */
export const fetchMetadata = (href: string): Promise<LinkCard | null> => {
  const key = metadataKey(href)
  if (key === null) return Promise.resolve(null)
  const cached = readEntry(key)
  if (cached !== undefined) return Promise.resolve(cached)

  let pending = inFlight.get(key)
  if (!pending) {
    pending = request(key).finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }
  return pending
}
