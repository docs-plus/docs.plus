/** The extension draws one glyph per name, so the list is closed. */
export const FACT_ICONS = [
  'location',
  'work',
  'posted',
  'stars',
  'language',
  'updated',
  'answers',
  'accepted'
] as const

export type FactIcon = (typeof FACT_ICONS)[number]

export interface Fact {
  icon: FactIcon
  text: string
}

// A card with no kind is a plain page.
export const LINK_KINDS = ['repo'] as const

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
  kind?: (typeof LINK_KINDS)[number]
  /** At most three. */
  facts?: Fact[]
  /** Every stage missed, and the card names the host only. */
  fallback?: true
  cached: boolean
  fetched_at: string
}

export interface ErrorResponse {
  success: false
  message: string
  code: 'INVALID_URL' | 'BLOCKED_URL'
}

export type StageResult = Omit<MetadataResponse, 'cached' | 'fetched_at' | 'fallback'> | null

/** Why the html stage missed. It goes to the `stages` log field only, never to the response. */
export type HtmlMiss = 'status:4xx' | 'status:5xx' | 'no-title' | 'timeout' | 'error'

/**
 * A special-stage API miss that may clear soon. The card that follows is cached for the
 * short TTL only, so a rate limit never pins a card without its facts for 24 h.
 */
export type SpecialMiss = 'rate-limit' | 'status:5xx' | 'timeout' | 'error'

/** A card the html stage built after a late or failed body read, so it gets the short TTL. */
export type HtmlCard = NonNullable<StageResult> & { retry?: true }

/**
 * A Redis entry. `fallback` and `retry` mark a short-TTL write, so a hit keeps the short
 * header. `retry` never reaches the wire.
 */
export type CacheEntry = NonNullable<StageResult> & { fallback?: true; retry?: true }

/**
 * Optional API credentials. Without them GitHub allows 60 calls an hour and Stack Exchange
 * 300 a day, per address. The GitHub token must reach public repositories only.
 */
export interface ApiKeys {
  githubToken: string | null
  stackExchangeKey: string | null
}

/**
 * Relayed bytes, an icon or a page image. `type` comes from the sniffed bytes, never the
 * upstream header.
 */
export type RelayedImage = { bytes: Uint8Array<ArrayBuffer>; type: string }

export type Miss = 'clean' | 'error'

/** Reads an image URL this process serves itself, without the network; null for any other URL. */
export type OwnImage = (url: string) => Promise<Response> | null

export interface Cache {
  get(key: string): Promise<CacheEntry | null>
  set(key: string, value: CacheEntry, ttlSeconds: number): Promise<void>
}

export interface Scraper {
  /** `html` is the head only. */
  scrape(input: { html: string; url: string }): Promise<{
    title?: string
    description?: string
    image?: string
    logo?: string
    publisher?: string
    author?: string
    date?: string
    lang?: string
    facts?: Fact[]
  }>
  /** JobPosting facts from the JSON-LD scripts in `body`, the bytes after the head. */
  jobFacts(body: string): Fact[] | undefined
}

/** Per-stage timeouts. One home so the stages and their tests agree. */
export const STAGE_TIMEOUT_MS = {
  oembed: 3_000,
  special: 3_000,
  html: 8_000
} as const

/** A repo answer is about 7 KB and a question about 1 KB. A larger body is a miss, unparsed. */
export const API_BODY_MAX_BYTES = 64 * 1024

/**
 * Every outbound call names docs.plus and nothing else. Never add another crawler's
 * token or a browser string to get past a bot wall. Reddit's API guidelines ask for the
 * plain identifier, so `handlers/reddit.ts` sends it alone. `openHop` sends it too, for
 * the icon and image routes.
 */
export const BOT_USER_AGENT = 'DocsplusBot/1.0' as const
export const LINK_PREVIEW_USER_AGENT = `Mozilla/5.0 (compatible; ${BOT_USER_AGENT}; +https://docs.plus)`
