import { normalizeHref } from '@docs.plus/extension-hyperlink'

/** Rich response shape returned by the new backend endpoint. */
export interface MetadataResponse {
  success: true
  url: string
  requested_url: string
  title: string
  description?: string
  lang?: string
  media_type?: 'website' | 'article' | 'video' | 'audio' | 'image' | 'profile' | 'document'
  author?: { name?: string; url?: string; avatar?: string }
  publisher?: { name?: string; url?: string; logo?: string; theme_color?: string }
  image?: { url: string; width?: number; height?: number; alt?: string }
  icon?: string
  favicon?: string
  oembed?: {
    type: 'video' | 'rich' | 'photo' | 'link'
    provider: string
    width?: number
    height?: number
    thumbnail?: string
  }
  published_at?: string
  modified_at?: string
  cached: boolean
  fetched_at: string
}

interface ErrorResponse {
  success: false
  message: string
  code: 'INVALID_URL' | 'BLOCKED_URL'
}

type ApiResponse = MetadataResponse | ErrorResponse

interface CacheEntry {
  data: MetadataResponse | null
  expiresAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const sessionCache = new Map<string, CacheEntry>()

const cacheKey = (href: string): string => normalizeHref(href)

export const getCachedMetadata = (href: string): MetadataResponse | null | undefined => {
  const entry = sessionCache.get(cacheKey(href))
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(cacheKey(href))
    return undefined
  }
  return entry.data
}

const setCachedMetadata = (href: string, data: MetadataResponse | null): void => {
  sessionCache.set(cacheKey(href), { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

const apiBaseUrl = (): string => {
  const base = process.env.NEXT_PUBLIC_RESTAPI_URL
  if (!base) throw new Error('NEXT_PUBLIC_RESTAPI_URL is not configured')
  return base
}

export interface FetchMetadataOptions {
  signal?: AbortSignal
}

/**
 * Hits the new GET /api/metadata endpoint on hocuspocus.server. The
 * backend never returns 5xx for upstream failures (always falls back to
 * a hostname+favicon shape), so non-ok responses here mean validation
 * (400) or rate-limit (429) — both cached as null to avoid hammering.
 */
export const fetchMetadata = async (
  href: string,
  { signal }: FetchMetadataOptions = {}
): Promise<MetadataResponse | null> => {
  const cached = getCachedMetadata(href)
  if (cached !== undefined) return cached

  try {
    const response = await fetch(`${apiBaseUrl()}/metadata?url=${encodeURIComponent(href)}`, {
      method: 'GET',
      signal
    })

    if (!response.ok) {
      console.error('Metadata API error:', response.status, response.statusText)
      setCachedMetadata(href, null)
      return null
    }

    const data: ApiResponse = await response.json()
    if (data.success) {
      setCachedMetadata(href, data)
      return data
    }

    console.error('Metadata API error:', data.message)
    setCachedMetadata(href, null)
    return null
  } catch (error) {
    if (signal?.aborted) return null
    console.error('Error fetching metadata:', error)
    setCachedMetadata(href, null)
    return null
  }
}
