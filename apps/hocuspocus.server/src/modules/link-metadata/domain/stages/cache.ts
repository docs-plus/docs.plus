import { createHash } from 'node:crypto'

import type { Cache, CacheEntry } from '../types'

export const CACHE_TTL_POSITIVE_SECONDS = 24 * 60 * 60
export const CACHE_TTL_NEGATIVE_SECONDS = 10 * 60

// One value serves the cache key and the upstream header. Keying on the raw header
// let a caller force fresh scrapes, and sending it raw let `en;q=0.1, fa` cache a
// Farsi page under the English key for every English reader.
export const primaryLangSubtag = (lang: string | undefined): string | null => {
  if (!lang) return null
  const first = lang.split(',')[0]?.split(';')[0]?.trim().split('-')[0]?.toLowerCase()
  return first && /^[a-z]{2,3}$/.test(first) ? first : null
}

/**
 * Cache key shape: `meta:v4:{sha1(canonical_url)}:{lang | '_'}`, plus `:g{generation}` for a
 * pad URL. The prefix moves whenever the stored value shape changes. Old keys then expire by
 * TTL, and a replica still on the old code never reads a value it cannot serve. It is not the
 * wire contract version.
 */
export const cacheKey = (
  canonicalUrl: string,
  lang: string | undefined,
  generation?: string
): string => {
  const hash = createHash('sha1').update(canonicalUrl).digest('hex')
  const base = `meta:v4:${hash}:${primaryLangSubtag(lang) ?? '_'}`
  return generation === undefined ? base : `${base}:g${generation}`
}

/** Longer than any entry TTL, so a pad's old entries are gone before its generation lapses to `0`. */
export const PAD_GENERATION_TTL_SECONDS = 2 * CACHE_TTL_POSITIVE_SECONDS

/** One generation per pad slug key. A new generation hides every entry under the old one. */
export const padGenerationKey = (slugKey: string): string => `meta:pad-gen:${slugKey}`

export const writeCache = async (
  cache: Cache,
  key: string,
  value: CacheEntry,
  kind: 'positive' | 'negative'
): Promise<void> => {
  const ttl = kind === 'positive' ? CACHE_TTL_POSITIVE_SECONDS : CACHE_TTL_NEGATIVE_SECONDS
  await cache.set(key, value, ttl)
}
