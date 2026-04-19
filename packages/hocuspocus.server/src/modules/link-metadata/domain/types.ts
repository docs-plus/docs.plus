/**
 * The wire contract (response side). The request side lives in http/schema.ts.
 * Additive changes only within v1; breaking changes mint a new path.
 */
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
  // NOTE: the raw `html` field from oEmbed providers is intentionally NOT
  // re-exposed here. It carries provider-controlled markup (iframes,
  // scripts, third-party trackers) and would create a stored-XSS sink for
  // any consumer that does `innerHTML = oembed.html`. If/when we need to
  // render real embeds, sanitize at this boundary first (allowlist
  // <iframe> from known provider hosts, drop everything else) and only
  // then add the field back.
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

export interface ErrorResponse {
  success: false
  message: string
  code: 'INVALID_URL' | 'BLOCKED_URL'
}

/** Stage output: either a full success payload or null (no match / failed). */
export type StageResult = Omit<MetadataResponse, 'cached' | 'fetched_at'> | null

/**
 * Inline port: the only thing domain code knows about caching.
 * `infra/redisCache.ts` is the production implementation; tests pass an in-memory fake.
 */
export interface Cache {
  get(key: string): Promise<StageResult | null>
  set(key: string, value: StageResult, ttlSeconds: number): Promise<void>
}

/**
 * Inline port: the only thing domain code knows about HTML scraping.
 * `infra/metascraper.ts` is the production implementation.
 */
export interface Scraper {
  scrape(input: { html: string; url: string }): Promise<{
    title?: string
    description?: string
    image?: string
    logo?: string
    publisher?: string
    author?: string
    date?: string
    lang?: string
    url?: string
  }>
}

/** Per-stage timeouts. Centralized so tests and pipeline agree. */
export const STAGE_TIMEOUT_MS = {
  oembed: 3_000,
  special: 3_000,
  html: 8_000
} as const

/**
 * Bot identity. Stages compose their own User-Agent around this so the
 * version bump only happens in one place. Stages don't share the full UA
 * string because each tier uses a different framing — see `htmlScrape.ts`
 * (compound UA for anti-bot allowlists) vs `handlers/reddit.ts` (plain
 * identifier per Reddit's API guidelines).
 */
export const BOT_USER_AGENT = 'DocsplusBot/1.0' as const
