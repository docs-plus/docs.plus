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
  // The provider `html` field is deliberately not re-exposed: it is
  // provider-controlled markup and a stored-XSS sink for any consumer doing
  // `innerHTML = oembed.html`. Adding it back means sanitizing at this boundary
  // first — allowlist <iframe> from known provider hosts, drop everything else.
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

export type StageResult = Omit<MetadataResponse, 'cached' | 'fetched_at'> | null

export interface Cache {
  get(key: string): Promise<StageResult | null>
  set(key: string, value: StageResult, ttlSeconds: number): Promise<void>
}

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
 * Stages compose their own User-Agent around this rather than sharing one
 * string. `htmlScrape.ts` needs a compound UA for anti-bot allowlists, and
 * `handlers/reddit.ts` needs a plain identifier per Reddit's API guidelines.
 */
export const BOT_USER_AGENT = 'DocsplusBot/1.0' as const
