import { describe, expect, test } from 'bun:test'

import { linkMetadataCacheTimeoutsTotal } from '../../../../lib/metrics'
import type { StageResult } from '../../domain/types'
import { CACHE_TIMEOUT_MS, createRedisCache } from '../../infra/redisCache'

const timeouts = async (op: 'read' | 'write'): Promise<number> =>
  (await linkMetadataCacheTimeoutsTotal.get()).values.find((v) => v.labels.op === op)?.value ?? 0

const fakeIoredis = () => {
  const store = new Map<string, string>()
  let lastSetArgs: { key: string; value: string; mode?: string; ttl?: number } | null = null
  return {
    store,
    get _last() {
      return lastSetArgs
    },
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, mode?: string, ttl?: number) => {
      store.set(key, value)
      lastSetArgs = { key, value, mode, ttl }
      return 'OK'
    }
  }
}

const sample: NonNullable<StageResult> = {
  success: true,
  url: 'https://example.com',
  requested_url: 'https://example.com',
  title: 'Example'
}

describe('createRedisCache', () => {
  test('returns a no-op adapter when redis is null', async () => {
    const cache = createRedisCache(null)
    expect(await cache.get('any')).toBeNull()
    await cache.set('any', sample, 60)
  })

  test('get parses stored JSON; returns null on miss', async () => {
    const fake = fakeIoredis()
    fake.store.set('k', JSON.stringify(sample))
    const cache = createRedisCache(fake as any)
    expect(await cache.get('k')).toEqual(sample)
    expect(await cache.get('missing')).toBeNull()
  })

  test('get returns null when stored payload is corrupt', async () => {
    const fake = fakeIoredis()
    fake.store.set('k', 'not json')
    const cache = createRedisCache(fake as any)
    expect(await cache.get('k')).toBeNull()
  })

  test('set serializes JSON and uses EX TTL in seconds', async () => {
    const fake = fakeIoredis()
    const cache = createRedisCache(fake as any)
    const before = await timeouts('write')
    await cache.set('k', sample, 1234)
    expect(await timeouts('write')).toBe(before)
    const last = fake._last!
    expect(last.key).toBe('k')
    expect(JSON.parse(last.value)).toEqual(sample)
    expect(last.mode).toBe('EX')
    expect(last.ttl).toBe(1234)
  })

  describe('when Redis stalls', () => {
    const stalled = { get: () => new Promise(() => {}), set: () => new Promise(() => {}) }

    test('get is a miss after the bound', async () => {
      const before = await timeouts('read')
      const start = performance.now()
      expect(await createRedisCache(stalled as any).get('k')).toBeNull()
      expect(performance.now() - start).toBeGreaterThanOrEqual(CACHE_TIMEOUT_MS - 5)
      expect(await timeouts('read')).toBe(before + 1)
    }, 1000)

    // A '0' here would serve a narrowed pad's old card; the throw makes the pipeline skip the cache.
    test('generation rejects, never falls back to 0', async () => {
      // Not `.rejects`: on a promise that never settles, it blocks Bun's test timeout.
      const outcome = await createRedisCache(stalled as any)
        .generation('pad')
        .then(
          (value) => value,
          (error: Error) => error.message
        )
      expect(outcome).toContain('timed out')
    }, 1000)

    test('set resolves after the bound, and counts the timeout', async () => {
      const before = await timeouts('write')
      await createRedisCache(stalled as any).set('k', sample, 60)
      expect(await timeouts('write')).toBe(before + 1)
    }, 1000)
  })

  test('set swallows errors (cache is best-effort)', async () => {
    const fake = {
      get: async () => null,
      set: async () => {
        throw new Error('redis down')
      }
    }
    const cache = createRedisCache(fake as any)
    await cache.set('k', sample, 60)
  })
})
