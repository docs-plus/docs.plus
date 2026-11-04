import { canonicalize } from './canonicalize'
import { isSafeUrl } from './ssrf'
import { cacheKey, padGenerationKey, writeCache } from './stages/cache'
import { runFallback } from './stages/fallback'
import {
  type Cache,
  type ErrorResponse,
  type Fact,
  FACT_ICONS,
  FACT_MAX,
  FACTS_MAX,
  type HtmlCard,
  type HtmlMiss,
  LINK_KINDS,
  type LinkMiss,
  type Scraper,
  type SpecialMiss,
  type StageResult
} from './types'

export interface PipelineStages {
  oembed: (canonicalUrl: string) => Promise<StageResult>
  special: (canonicalUrl: string) => Promise<StageResult | SpecialMiss>
  html: (
    canonicalUrl: string,
    scraper: Scraper,
    acceptLanguage: string | undefined
  ) => Promise<HtmlCard | HtmlMiss>
}

export interface StageEvent {
  stage: string
  hit: boolean
  durationMs: number
  reason?: HtmlMiss | SpecialMiss
}

export interface PipelineInput {
  requestedUrl: string
  acceptLanguage: string | undefined
  cache: Cache
  scraper: Scraper
  stages: PipelineStages
  publicUrl?: string | null
  /** The slug key of the pad a URL opens; its cards join that pad's group. */
  padSlugOf?: (url: string) => string | null
  /** Optional logger hook the controller wires up; pipeline stays framework-free. */
  onStage?: (event: StageEvent) => void
}

/** `retry` means a stage missed or read less for a reason that may clear soon. */
export type PipelineResult =
  | {
      kind: 'success'
      payload: NonNullable<StageResult>
      fromCache: boolean
      fallback: boolean
      retry: boolean
      miss?: LinkMiss
    }
  | { kind: 'error'; status: 400; message: string; code: ErrorResponse['code'] }

const orderedStageNames = ['oembed', 'special', 'html'] as const

const LINK_MISS_OF: Record<HtmlMiss | SpecialMiss, LinkMiss> = {
  'status:4xx': 'blocked',
  'no-title': 'no-preview',
  'status:5xx': 'unreachable',
  timeout: 'unreachable',
  error: 'unreachable',
  'rate-limit': 'unreachable'
}

const TEXT_MAX = 300
const NAME_MAX = 128
const URL_MAX = 2048
const TOKEN_MAX = 64
const OEMBED_TYPES = ['video', 'rich', 'photo', 'link'] as const

/** Keeps `max` code points, so a cut never splits a surrogate pair, and adds "…". */
const cut = (value: string, max: number): string => {
  if (value.length <= max) return value
  let points = 0
  let end = 0
  for (const point of value) {
    if (points === max) return `${value.slice(0, end).trimEnd()}…`
    points += 1
    end += point.length
  }
  return value
}

const WHITESPACE_RUN = /\s+/g
// C0, DEL, C1, and the bidi marks, embeddings, overrides and isolates. ZWNJ and ZWJ stay:
// Persian words and emoji sequences need them.
// eslint-disable-next-line no-control-regex -- matching them is the whole point
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

const clean = (value: string): string =>
  value.replace(WHITESPACE_RUN, ' ').replace(CONTROL_CHARS, '').replace(WHITESPACE_RUN, ' ').trim()

/**
 * Whitespace collapses before the strip, so a newline stays a word break, and again after,
 * so a stripped mark leaves one space. The cut counts what is left.
 */
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? cut(clean(value), max) : undefined

// A cut URL names another resource, and the image route would fetch it, so it is dropped.
const link = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length <= URL_MAX && /^https?:\/\//i.test(value)
    ? value
    : undefined

const token = <T>(value: T | undefined): T | undefined =>
  typeof value === 'string' && value.length <= TOKEN_MAX ? value : undefined

const size = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isInteger(value) && value > 0 ? value : undefined

const unlessEmpty = <T extends object>(value: T): T | undefined =>
  Object.values(value).some((field) => field !== undefined) ? value : undefined

const capFacts = (facts: unknown): Fact[] | undefined => {
  if (!Array.isArray(facts)) return undefined
  const kept: Fact[] = []
  for (const fact of facts) {
    const icon = FACT_ICONS.find((name) => name === fact?.icon)
    const value = text(fact?.text, FACT_MAX)
    if (icon && value) kept.push({ icon, text: value })
    if (kept.length === FACTS_MAX) break
  }
  return kept.length > 0 ? kept : undefined
}

/**
 * Every stage result and the fallback card pass here before Redis and the reply. The card
 * is rebuilt field by field from untrusted page and provider JSON, so no unknown key and
 * no unbounded string survives. The stored `requested_url` is the canonical URL.
 */
const capCard = (card: NonNullable<StageResult>, canonical: string): NonNullable<StageResult> => {
  const imageUrl = link(card.image?.url)
  return {
    success: true,
    url: link(card.url) ?? canonical,
    requested_url: canonical,
    title: text(card.title, TEXT_MAX) ?? '',
    description: text(card.description, TEXT_MAX),
    lang: token(card.lang),
    media_type: token(card.media_type),
    author: card.author
      ? unlessEmpty({
          name: text(card.author.name, NAME_MAX),
          url: link(card.author.url),
          avatar: link(card.author.avatar)
        })
      : undefined,
    publisher: card.publisher
      ? unlessEmpty({
          name: text(card.publisher.name, NAME_MAX),
          url: link(card.publisher.url),
          logo: link(card.publisher.logo),
          theme_color: token(card.publisher.theme_color)
        })
      : undefined,
    image: imageUrl
      ? {
          url: imageUrl,
          width: size(card.image?.width),
          height: size(card.image?.height),
          alt: text(card.image?.alt, TEXT_MAX)
        }
      : undefined,
    icon: link(card.icon),
    favicon: link(card.favicon),
    oembed: card.oembed
      ? {
          type: OEMBED_TYPES.find((type) => type === card.oembed?.type) ?? 'rich',
          provider: text(card.oembed.provider, NAME_MAX) ?? '',
          width: size(card.oembed.width),
          height: size(card.oembed.height),
          thumbnail: link(card.oembed.thumbnail)
        }
      : undefined,
    published_at: token(card.published_at),
    modified_at: token(card.modified_at),
    kind: LINK_KINDS.find((kind) => kind === card.kind),
    facts: capFacts(card.facts)
  }
}

/**
 * A pad URL's key carries the pad's generation, read before any fetch. A scrape in flight
 * when the pad narrows then writes under a key nobody reads. Null when that read fails: the
 * pad card skips the cache rather than risk an old generation.
 */
const keyFor = async (
  cache: Cache,
  canonical: string,
  lang: string | undefined,
  padSlug: string | null
): Promise<string | null> => {
  if (!padSlug) return cacheKey(canonical, lang)
  try {
    return cacheKey(canonical, lang, await cache.generation(padGenerationKey(padSlug)))
  } catch {
    return null
  }
}

export const runPipeline = async (input: PipelineInput): Promise<PipelineResult> => {
  const { requestedUrl, acceptLanguage, cache, scraper, stages, publicUrl, padSlugOf, onStage } =
    input

  if (!isSafeUrl(requestedUrl)) {
    let parsed: URL | null = null
    try {
      parsed = new URL(requestedUrl)
    } catch {
      // fallthrough
    }
    return parsed
      ? { kind: 'error', status: 400, message: 'URL is not allowed', code: 'BLOCKED_URL' }
      : { kind: 'error', status: 400, message: 'URL is not valid', code: 'INVALID_URL' }
  }

  const canonical = canonicalize(requestedUrl)
  const padSlug = padSlugOf?.(canonical) ?? null
  const key = await keyFor(cache, canonical, acceptLanguage, padSlug)

  const cached = key ? await cache.get(key) : null
  if (cached) {
    const { fallback, retry, miss, ...payload } = cached
    return {
      kind: 'success',
      payload: { ...payload, requested_url: requestedUrl },
      fromCache: true,
      fallback: fallback === true,
      retry: retry === true,
      ...(fallback && miss ? { miss } : {})
    }
  }

  let retry = false
  // The first reason wins. Special runs before html, and a site API that missed may answer later.
  let missReason: HtmlMiss | SpecialMiss | undefined
  for (const name of orderedStageNames) {
    const start = Date.now()
    let outcome: HtmlCard | null | HtmlMiss | SpecialMiss
    try {
      outcome =
        name === 'html'
          ? await stages.html(canonical, scraper, acceptLanguage)
          : await stages[name](canonical)
    } catch {
      // A misbehaving stage must not block the fallback. Treat throws as misses.
      outcome = null
    }
    const reason = typeof outcome === 'string' ? outcome : undefined
    const result = typeof outcome === 'string' ? null : outcome
    if ((name === 'special' && reason) || result?.retry) retry = true
    if (reason) missReason ??= reason
    onStage?.({
      stage: name,
      hit: result !== null,
      durationMs: Date.now() - start,
      ...(reason ? { reason } : {})
    })

    if (result) {
      const card = capCard(result, canonical)
      // A redirect into a pad must not store that pad's title outside its generation.
      const landedOn = padSlugOf?.(card.url) ?? null
      if (key && (!landedOn || landedOn === padSlug)) {
        await writeCache(
          cache,
          key,
          retry ? { ...card, retry: true } : card,
          retry ? 'negative' : 'positive'
        )
      }
      return {
        kind: 'success',
        payload: { ...card, requested_url: requestedUrl },
        fromCache: false,
        fallback: false,
        retry
      }
    }
  }

  const card = capCard(runFallback(canonical, publicUrl), canonical)
  const miss = missReason ? LINK_MISS_OF[missReason] : undefined
  if (key) {
    await writeCache(cache, key, { ...card, fallback: true, ...(miss ? { miss } : {}) }, 'negative')
  }
  onStage?.({ stage: 'fallback', hit: true, durationMs: 0 })
  return {
    kind: 'success',
    payload: { ...card, requested_url: requestedUrl },
    fromCache: false,
    fallback: true,
    retry,
    ...(miss ? { miss } : {})
  }
}
