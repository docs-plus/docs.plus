import { randomUUID } from 'node:crypto'

import type { RedisClient } from '../../../types/redis.types'
import type { ArchiveCache, ArchiveSnapshot, Cache, CacheEntry } from '../domain/types'

/**
 * JSON values under a TTL. A failed or disabled read is null and a failed write is dropped, so
 * a Redis blip never breaks a request: both caches are best-effort.
 */
const jsonStore = (redis: RedisClient | null) => ({
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const raw = redis ? await redis.get(key) : null
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  set: async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    try {
      await redis?.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {
      /* swallow — cache is best-effort */
    }
  }
})

/** The `ArchiveCache` port on the same client. */
export const createArchiveCache = (redis: RedisClient | null): ArchiveCache => {
  const store = jsonStore(redis)
  return {
    get: (key) => store.get<{ snapshot: ArchiveSnapshot | null }>(key),
    set: (key, snapshot, ttlSeconds) => store.set(key, { snapshot }, ttlSeconds)
  }
}

/**
 * Implements the `Cache` port using ioredis. The generation calls reject, so the pipeline
 * skips a pad's cache and `forgetPad` logs the failure. With Redis off, every pad is at `0`.
 */
export const createRedisCache = (redis: RedisClient | null): Cache => {
  const store = jsonStore(redis)
  return {
    get: (key) => store.get<CacheEntry>(key),
    set: (key, value, ttlSeconds) => store.set(key, value, ttlSeconds),
    generation: async (key) => (redis ? ((await redis.get(key)) ?? '0') : '0'),
    newGeneration: async (key, ttlSeconds) => {
      await redis?.set(key, randomUUID(), 'EX', ttlSeconds)
    }
  }
}
