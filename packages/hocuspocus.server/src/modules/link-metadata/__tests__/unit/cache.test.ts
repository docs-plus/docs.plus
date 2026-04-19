import { describe, expect, test } from 'bun:test'

import {
  CACHE_TTL_NEGATIVE_SECONDS,
  CACHE_TTL_POSITIVE_SECONDS,
  cacheKey,
  readCache,
  writeCache
} from '../../domain/stages/cache'
import type { Cache, StageResult } from '../../domain/types'

interface FakeCache extends Cache {
  store: Map<string, StageResult>
  lastTtl: number
}

const makeFakeCache = (): FakeCache => {
  const store = new Map<string, StageResult>()
  const fake: FakeCache = {
    store,
    lastTtl: -1,
    get: async (key) => store.get(key) ?? null,
    set: async (key, value, ttl) => {
      store.set(key, value)
      fake.lastTtl = ttl
    }
  }
  return fake
}

const sample: NonNullable<StageResult> = {
  success: true,
  url: 'https://example.com/x',
  requested_url: 'https://example.com/x',
  title: 'Example'
}

describe('cacheKey', () => {
  test('uses meta:v1: prefix and sha1 of the canonical url', () => {
    const key = cacheKey('https://example.com/x', 'en-US')
    expect(key).toMatch(/^meta:v1:[a-f0-9]{40}:en-US$/)
  })

  test('uses "_" when lang is undefined', () => {
    const key = cacheKey('https://example.com/x', undefined)
    expect(key.endsWith(':_')).toBe(true)
  })

  test('two different urls produce different keys', () => {
    expect(cacheKey('https://a.com', 'en')).not.toBe(cacheKey('https://b.com', 'en'))
  })

  test('two different langs produce different keys', () => {
    expect(cacheKey('https://a.com', 'en')).not.toBe(cacheKey('https://a.com', 'fr'))
  })
})

describe('readCache', () => {
  test('returns null on miss', async () => {
    const cache = makeFakeCache()
    expect(await readCache(cache, 'https://example.com', 'en')).toBeNull()
  })

  test('returns stored payload on hit', async () => {
    const cache = makeFakeCache()
    cache.store.set(cacheKey('https://example.com', 'en'), sample)
    expect(await readCache(cache, 'https://example.com', 'en')).toEqual(sample)
  })
})

describe('writeCache', () => {
  test('stores a positive result with positive TTL', async () => {
    const cache = makeFakeCache()
    await writeCache(cache, 'https://example.com', 'en', sample, 'positive')
    expect(cache.lastTtl).toBe(CACHE_TTL_POSITIVE_SECONDS)
  })

  test('stores a fallback result with negative TTL', async () => {
    const cache = makeFakeCache()
    await writeCache(cache, 'https://example.com', 'en', sample, 'negative')
    expect(cache.lastTtl).toBe(CACHE_TTL_NEGATIVE_SECONDS)
  })
})
