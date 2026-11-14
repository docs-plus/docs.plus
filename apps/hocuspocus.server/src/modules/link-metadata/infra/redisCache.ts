import { randomUUID } from 'node:crypto'

import { linkMetadataCacheTimeoutsTotal } from '../../../lib/metrics'
import { TIMED_OUT, withinTimeout } from '../../../lib/withinTimeout'
import type { RedisClient } from '../../../types/redis.types'
import type { ArchiveCache, ArchiveSnapshot, Cache, CacheEntry } from '../domain/types'

/**
 * Far above a normal round trip and far below a scrape. A stalled Redis then costs one miss,
 * not the shared 60 s `commandTimeout` (#789).
 */
export const CACHE_TIMEOUT_MS = 150

const boundedGet = async (redis: RedisClient, key: string): Promise<string | null> => {
  const raced = await withinTimeout(redis.get(key), CACHE_TIMEOUT_MS)
  if (raced === TIMED_OUT) {
    linkMetadataCacheTimeoutsTotal.inc({ op: 'read' })
    throw new Error(`Redis get timed out after ${CACHE_TIMEOUT_MS} ms`)
  }
  return raced
}

/**
 * JSON values under a TTL. A failed, slow or disabled read is null, and a failed or slow write
 * is dropped. So a Redis blip or stall never breaks a request: both caches are best-effort.
 */
const jsonStore = (redis: RedisClient | null) => ({
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const raw = redis ? await boundedGet(redis, key) : null
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  set: async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    try {
      if (redis) {
        const raced = await withinTimeout(
          redis.set(key, JSON.stringify(value), 'EX', ttlSeconds),
          CACHE_TIMEOUT_MS
        )
        if (raced === TIMED_OUT) linkMetadataCacheTimeoutsTotal.inc({ op: 'write' })
      }
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
 * Implements the `Cache` port using ioredis. The generation calls reject, and so does a slow
 * generation read. The pipeline then skips a pad's cache, and `forgetPad` logs the failure.
 * With Redis off, every pad is at `0`.
 */
export const createRedisCache = (redis: RedisClient | null): Cache => {
  const store = jsonStore(redis)
  return {
    get: (key) => store.get<CacheEntry>(key),
    set: (key, value, ttlSeconds) => store.set(key, value, ttlSeconds),
    generation: async (key) => (redis ? ((await boundedGet(redis, key)) ?? '0') : '0'),
    newGeneration: async (key, ttlSeconds) => {
      await redis?.set(key, randomUUID(), 'EX', ttlSeconds)
    }
  }
}
