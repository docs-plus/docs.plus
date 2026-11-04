import { describe, expect, mock, test } from 'bun:test'

import { runPipeline, type StageEvent } from '../../domain/pipeline'
import type { Cache, CacheEntry, Scraper, StageResult } from '../../domain/types'

interface FakeCache extends Cache {
  lastTtl: number
}

const fakeCache = (): FakeCache => {
  const store = new Map<string, CacheEntry>()
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

const noopScraper: Scraper = { scrape: async () => ({}), jobFacts: () => undefined }
// The html stage never returns null; a miss is a reason string.
const noHtml = async () => 'no-title' as const

describe('runPipeline', () => {
  test('rejects unparseable URL with INVALID_URL', async () => {
    const result = await runPipeline({
      requestedUrl: 'not a url',
      acceptLanguage: undefined,
      cache: fakeCache(),
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: noHtml }
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
      stages: { oembed: async () => null, special: async () => null, html: noHtml }
    })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.code).toBe('BLOCKED_URL')
  })

  test('returns a cache stage hit without calling stages', async () => {
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
      stages: { oembed, special: async () => null, html: noHtml }
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
      stages: { oembed: async () => null, special: async () => null, html: noHtml }
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
      stages: { oembed: async () => null, special: async () => null, html: noHtml }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.payload.title).toBe('cached')
      expect(result.payload.requested_url).toBe('https://EXAMPLE.com/?utm_source=x')
      expect(result.payload.url).toBe('https://example.com/')
    }
  })

  test('caps or drops scraped strings in both the cache write and the reply', async () => {
    const cache = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    // Each emoji is two UTF-16 units, so a UTF-16 cut fails the code-point count.
    const html = mock(async () => ({
      ...ok('😀'.repeat(512 * 1024)),
      publisher: { name: 'p'.repeat(1000) },
      image: { url: 'data:image/png;base64,AAAA' },
      icon: `https://example.com/${'i'.repeat(3000)}`
    }))

    const result = await runPipeline({
      requestedUrl: 'https://example.com/?utm_source=x',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html }
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') return
    const stored = await cache.get(cacheKey('https://example.com/', 'en'))
    for (const card of [stored, result.payload]) {
      expect([...(card?.title ?? '')]).toHaveLength(301)
      expect(card?.title.endsWith('😀…')).toBe(true)
      expect([...(card?.publisher?.name ?? '')]).toHaveLength(129)
      expect(card?.image).toBeUndefined()
      expect(card?.icon).toBeUndefined()
    }
    expect(stored?.requested_url).toBe('https://example.com/')
    expect(result.payload.requested_url).toBe('https://example.com/?utm_source=x')
  })

  test('keeps at most three known facts, cut, and a known kind', async () => {
    const cache = fakeCache()
    const html = mock(async () => ({
      ...ok('T'),
      kind: 'video' as never,
      // Untrusted shapes on purpose: capCard must drop what the contract does not allow.
      facts: [
        { icon: 'stars', text: '' },
        { icon: 'unknown' as never, text: 'x' },
        { icon: 'location', text: 'L'.repeat(500) },
        { icon: 'work', text: 'Full-time' },
        { icon: 'posted', text: 'Posted Oct 31' },
        { icon: 'answers', text: '4 answers' }
      ] as never
    }))
    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html }
    })
    if (result.kind !== 'success') throw new Error('expected success')
    expect(result.payload.kind).toBeUndefined()
    expect(result.payload.facts?.map((fact) => fact.icon)).toEqual(['location', 'work', 'posted'])
    expect([...(result.payload.facts?.[0]?.text ?? '')]).toHaveLength(65)
  })

  test('a special-stage miss that may clear soon caches the next card for the short TTL', async () => {
    const { cacheKey, CACHE_TTL_NEGATIVE_SECONDS } = await import('../../domain/stages/cache')
    const cache = fakeCache()
    const events: StageEvent[] = []
    const run = () =>
      runPipeline({
        requestedUrl: 'https://github.com/docs-plus/docs.plus',
        acceptLanguage: 'en',
        cache,
        scraper: noopScraper,
        stages: {
          oembed: async () => null,
          special: async () => 'rate-limit' as const,
          html: async () => ok('scraped')
        },
        onStage: (e) => events.push(e)
      })

    const first = await run()
    expect(first).toMatchObject({ kind: 'success', fallback: false, retry: true })
    expect(cache.lastTtl).toBe(CACHE_TTL_NEGATIVE_SECONDS)
    expect(events.find((e) => e.stage === 'special')).toMatchObject({
      hit: false,
      reason: 'rate-limit'
    })
    const stored = await cache.get(cacheKey('https://github.com/docs-plus/docs.plus', 'en'))
    expect(stored?.retry).toBe(true)

    const again = await run()
    expect(again).toMatchObject({ kind: 'success', fromCache: true, retry: true })
    if (again.kind === 'success') expect('retry' in again.payload).toBe(false)
  })

  test('an html card built from a cut body read gets the short TTL, and no marker leaves', async () => {
    const { CACHE_TTL_NEGATIVE_SECONDS } = await import('../../domain/stages/cache')
    const cache = fakeCache()
    const result = await runPipeline({
      requestedUrl: 'https://jobs.lever.co/acme/1',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: {
        oembed: async () => null,
        special: async () => null,
        html: async () => ({ ...ok('Job'), retry: true as const })
      }
    })
    expect(result).toMatchObject({ kind: 'success', retry: true })
    expect(cache.lastTtl).toBe(CACHE_TTL_NEGATIVE_SECONDS)
    if (result.kind === 'success') expect('retry' in result.payload).toBe(false)
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
      stages: { oembed, special: async () => null, html: noHtml }
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
      stages: { oembed: async () => null, special: async () => null, html: noHtml },
      onStage: (e) => events.push({ stage: e.stage, hit: e.hit })
    })
    expect(events.map((e) => e.stage)).toEqual(['oembed', 'special', 'html', 'fallback'])
    expect(events.at(-1)?.hit).toBe(true)
  })

  test('logs the html miss reason as a miss, never as a hit', async () => {
    const events: StageEvent[] = []
    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache: fakeCache(),
      scraper: noopScraper,
      stages: {
        oembed: async () => null,
        special: async () => null,
        html: async () => 'status:4xx' as const
      },
      onStage: (e) => events.push(e)
    })
    expect(events.find((e) => e.stage === 'html')).toMatchObject({
      hit: false,
      reason: 'status:4xx'
    })
    expect(result.kind === 'success' && result.fallback).toBe(true)
  })
})
