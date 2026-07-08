import { createHash } from 'node:crypto'

import type { Cache, StageResult } from '../types'

export const CACHE_TTL_POSITIVE_SECONDS = 24 * 60 * 60
export const CACHE_TTL_NEGATIVE_SECONDS = 10 * 60

// Cap the cache-key language dimension to a real 2-3 letter subtag — the full
// header still forwards upstream. Keying on the raw header lets a caller vary
// it to force fresh scrapes; bounding to a language shape caps the cardinality.
const primaryLangSubtag = (lang: string | undefined): string => {
  if (!lang) return '_'
  const first = lang.split(',')[0]?.split(';')[0]?.trim().split('-')[0]?.toLowerCase()
  return first && /^[a-z]{2,3}$/.test(first) ? first : '_'
}

/**
 * Cache key shape: `meta:v1:{sha1(canonical_url)}:{lang | '_'}`.
 * The `v1:` prefix gives an internal versioning dimension so the future
 * extracted microservice can share Redis with the monolith during cutover.
 */
export const cacheKey = (canonicalUrl: string, lang: string | undefined): string => {
  const hash = createHash('sha1').update(canonicalUrl).digest('hex')
  return `meta:v1:${hash}:${primaryLangSubtag(lang)}`
}

export const readCache = async (
  cache: Cache,
  canonicalUrl: string,
  lang: string | undefined
): Promise<StageResult> => cache.get(cacheKey(canonicalUrl, lang))

export const writeCache = async (
  cache: Cache,
  canonicalUrl: string,
  lang: string | undefined,
  value: NonNullable<StageResult>,
  kind: 'positive' | 'negative'
): Promise<void> => {
  const ttl = kind === 'positive' ? CACHE_TTL_POSITIVE_SECONDS : CACHE_TTL_NEGATIVE_SECONDS
  await cache.set(cacheKey(canonicalUrl, lang), value, ttl)
}
