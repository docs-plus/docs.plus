import { normalizeHref } from '@docs.plus/extension-hyperlink'
import { apiBaseUrl } from '@utils/apiBaseUrl'

import { linkDestination } from './internalDocumentLink'
import { LINK_FACT_ICONS, LINK_MISSES, type LinkCard, type LinkFact, type LinkMiss } from './types'

interface MetadataResponse {
  success: true
  url: string
  title: string
  description?: string
  image?: { url: string }
  kind?: unknown
  facts?: unknown
  fallback?: unknown
  miss?: unknown
  media_type?: unknown
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
const FACTS_MAX = 3
const REQUEST_TIMEOUT_MS = 15_000
const sessionCache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<LinkCard | null>>()

/**
 * One string is both the cache key and the `?url=` value. The fragment never changes the
 * page, so it is dropped. `null` means no request: mailto:, tel:, app schemes, and every
 * same-origin pad, whose answer depends on the reader (Private), so a URL key must not hold it.
 */
const metadataKey = (href: string): string | null => {
  try {
    const url = new URL(normalizeHref(href))
    if (linkDestination(url.href).kind !== 'web') return null
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

const KNOWN_FACT_ICONS: ReadonlySet<string> = new Set(LINK_FACT_ICONS)

const isFact = (value: unknown): value is LinkFact => {
  const fact = value as { icon?: unknown; text?: unknown } | null
  return (
    typeof fact?.icon === 'string' &&
    KNOWN_FACT_ICONS.has(fact.icon) &&
    typeof fact.text === 'string' &&
    fact.text.length > 0
  )
}

/** An icon this build cannot draw is dropped, so a newer server never breaks the card. */
const toFacts = (value: unknown): LinkFact[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const facts = value
    .filter(isFact)
    .slice(0, FACTS_MAX)
    .map(({ icon, text }) => ({ icon, text }))
  return facts.length > 0 ? facts : undefined
}

const KNOWN_MISSES: ReadonlySet<string> = new Set(LINK_MISSES)

/** A reason this build does not know is dropped, so the card says the general line. */
const toMiss = (value: unknown): LinkMiss | undefined =>
  typeof value === 'string' && KNOWN_MISSES.has(value) ? (value as LinkMiss) : undefined

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
    : undefined,
  fallback: data.fallback === true ? true : undefined,
  miss: data.fallback === true ? toMiss(data.miss) : undefined,
  file: data.media_type === 'document' ? true : undefined,
  kind: data.kind === 'repo' ? 'repo' : undefined,
  facts: toFacts(data.facts)
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
