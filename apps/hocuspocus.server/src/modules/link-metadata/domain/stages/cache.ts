import { createHash } from 'node:crypto'

import type { Cache, StageResult } from '../types'

export const CACHE_TTL_POSITIVE_SECONDS = 24 * 60 * 60
export const CACHE_TTL_NEGATIVE_SECONDS = 10 * 60

/**
 * Cache key shape: `meta:v1:{sha1(canonical_url)}:{lang | '_'}`.
 * The `v1:` prefix gives an internal versioning dimension so the future
 * extracted microservice can share Redis with the monolith during cutover.
 */
export const cacheKey = (canonicalUrl: string, lang: string | undefined): string => {
  const hash = createHash('sha1').update(canonicalUrl).digest('hex')
  return `meta:v1:${hash}:${lang || '_'}`
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
