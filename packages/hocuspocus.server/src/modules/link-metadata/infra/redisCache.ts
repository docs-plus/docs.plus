import type { RedisClient } from '../../../types/redis.types'
import type { Cache, StageResult } from '../domain/types'

/**
 * Implements the `Cache` port using ioredis. Cache failures are logged
 * by ioredis itself; here they're swallowed so a Redis blip doesn't
 * break a metadata fetch (cache is best-effort by design).
 */
export const createRedisCache = (redis: RedisClient | null): Cache => {
  if (!redis) {
    return {
      get: async () => null,
      set: async () => {
        /* no-op when Redis is disabled */
      }
    }
  }

  return {
    get: async (key) => {
      try {
        const raw = await redis.get(key)
        if (!raw) return null
        return JSON.parse(raw) as StageResult
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
    }
  }
}
