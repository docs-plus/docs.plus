import { describe, expect, test } from 'bun:test'

import type { StageResult } from '../../domain/types'
import { createRedisCache } from '../../infra/redisCache'

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
    await cache.set('k', sample, 1234)
    const last = fake._last!
    expect(last.key).toBe('k')
    expect(JSON.parse(last.value)).toEqual(sample)
    expect(last.mode).toBe('EX')
    expect(last.ttl).toBe(1234)
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
