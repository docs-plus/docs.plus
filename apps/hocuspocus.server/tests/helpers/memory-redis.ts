import type { RedisClient } from '../../src/types/redis.types'

/**
 * The two ioredis calls the link-metadata cache makes, over one in-memory store.
 * TTL arguments are ignored. Any other method is missing, so a test that reaches one fails.
 */
export const createMemoryRedis = (): RedisClient => {
  const values = new Map<string, string>()
  const client = {
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string, ..._ttl: unknown[]) => {
      values.set(key, value)
      return 'OK' as const
    }
  }
  return client as unknown as RedisClient
}
