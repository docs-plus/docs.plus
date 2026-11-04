import { randomUUID } from 'node:crypto'

import type { RedisClient } from '../../../types/redis.types'
import type { ArchiveCache, ArchiveSnapshot, Cache, CacheEntry } from '../domain/types'

/** The `ArchiveCache` port on the same client. Failures are swallowed, like the card cache. */
export const createArchiveCache = (redis: RedisClient | null): ArchiveCache => ({
  get: async (key) => {
    try {
      const raw = redis ? await redis.get(key) : null
      return raw ? (JSON.parse(raw) as { snapshot: ArchiveSnapshot | null }) : null
    } catch {
      return null
    }
  },
  set: async (key, snapshot, ttlSeconds) => {
    try {
      await redis?.set(key, JSON.stringify({ snapshot }), 'EX', ttlSeconds)
    } catch {
      /* swallow — cache is best-effort */
    }
  }
})

/**
 * Implements the `Cache` port using ioredis. A failed `get` or `set` is swallowed, so a
 * Redis blip never breaks a metadata fetch. The generation calls reject, so the pipeline
 * skips a pad's cache and `forgetPad` logs the failure.
 */
export const createRedisCache = (redis: RedisClient | null): Cache => {
  if (!redis) {
    return {
      get: async () => null,
      set: async () => {
        /* no-op when Redis is disabled */
      },
      generation: async () => '0',
      newGeneration: async () => {}
    }
  }

  return {
    get: async (key) => {
      try {
        const raw = await redis.get(key)
        if (!raw) return null
        return JSON.parse(raw) as CacheEntry
      } catch {
        return null
      }
    },
    set: async (key, value, ttlSeconds) => {
      try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
      } catch {
        /* swallow — cache is best-effort */
      }
    },
    generation: async (key) => (await redis.get(key)) ?? '0',
    newGeneration: async (key, ttlSeconds) => {
      await redis.set(key, randomUUID(), 'EX', ttlSeconds)
    }
  }
}
