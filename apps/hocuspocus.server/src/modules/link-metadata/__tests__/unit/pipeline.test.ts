import { describe, expect, mock, test } from 'bun:test'

import { runPipeline } from '../../domain/pipeline'
import type { Cache, Scraper, StageResult } from '../../domain/types'

interface FakeCache extends Cache {
  lastTtl: number
}

const fakeCache = (): FakeCache => {
  const store = new Map<string, StageResult>()
  const fake: FakeCache = {
    lastTtl: -1,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v, ttl) => {
      store.set(k, v)
      fake.lastTtl = ttl
    }
  }
  return fake
}

const ok = (title: string): NonNullable<StageResult> => ({
  success: true,
  url: 'https://example.com/',
  requested_url: 'https://example.com/',
  title
})

const noopScraper: Scraper = { scrape: async () => ({}) }

describe('runPipeline', () => {
  test('rejects unparseable URL with INVALID_URL', async () => {
    const result = await runPipeline({
      requestedUrl: 'not a url',
      acceptLanguage: undefined,
      cache: fakeCache(),
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.code).toBe('INVALID_URL')
  })

  test('rejects private IP with BLOCKED_URL', async () => {
    const result = await runPipeline({
      requestedUrl: 'http://192.168.1.1',
      acceptLanguage: undefined,
      cache: fakeCache(),
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.code).toBe('BLOCKED_URL')
  })

  test('returns L3 cache hit without calling stages', async () => {
    const cache = fakeCache()
    await cache.set('any', ok('cached'), 60)
    const oembed = mock(async () => null)
    const cache2 = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    await cache2.set(cacheKey('https://example.com/', 'en'), ok('cached'), 60)

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache: cache2,
      scraper: noopScraper,
      stages: { oembed, special: async () => null, html: async () => null }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.payload.title).toBe('cached')
      expect(result.fromCache).toBe(true)
    }
    expect(oembed).not.toHaveBeenCalled()
  })

  test('returns first-hit stage and writes positive cache', async () => {
    const cache = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    const oembed = mock(async () => ok('oembed'))
    const special = mock(async () => ok('special'))
    const html = mock(async () => ok('html'))

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed, special, html }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('oembed')
    expect(special).not.toHaveBeenCalled()
    expect(html).not.toHaveBeenCalled()
    expect(await cache.get(cacheKey('https://example.com/', 'en'))).not.toBeNull()
  })

  test('falls through when earlier stages return null', async () => {
    const cache = fakeCache()
    const html = mock(async () => ok('html'))

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('html')
    expect(html).toHaveBeenCalled()
  })

  test('returns fallback (negative cache) when all stages return null', async () => {
    const cache = fakeCache()
    const { CACHE_TTL_NEGATIVE_SECONDS } = await import('../../domain/stages/cache')

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('example.com')
    expect(cache.lastTtl).toBe(CACHE_TTL_NEGATIVE_SECONDS)
  })

  test('canonicalizes the requested URL before SSRF + cache lookup', async () => {
    const cache = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    await cache.set(cacheKey('https://example.com/', 'en'), ok('cached'), 60)

    const result = await runPipeline({
      requestedUrl: 'https://EXAMPLE.com/?utm_source=x',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.payload.title).toBe('cached')
      expect(result.payload.requested_url).toBe('https://EXAMPLE.com/?utm_source=x')
      expect(result.payload.url).toBe('https://example.com/')
    }
  })

  test('treats stage throws as misses and continues to fallback', async () => {
    const cache = fakeCache()
    const oembed = mock(async (): Promise<StageResult> => {
      throw new Error('boom')
    })
    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed, special: async () => null, html: async () => null }
    })
    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('example.com')
    expect(oembed).toHaveBeenCalled()
  })

  test('emits onStage events for each stage and the fallback', async () => {
    const events: { stage: string; hit: boolean }[] = []
    await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache: fakeCache(),
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null },
      onStage: (e) => events.push({ stage: e.stage, hit: e.hit })
    })
    expect(events.map((e) => e.stage)).toEqual(['oembed', 'special', 'html', 'fallback'])
    expect(events.at(-1)?.hit).toBe(true)
  })
})
