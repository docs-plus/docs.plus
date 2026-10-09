import type { RedisClient } from '../../../types/redis.types'

export type DedupeClaim = 'claimed' | 'pending' | 'done'

export interface WebhookDedupe {
  /** Throws on a Redis error, so the caller answers 5xx and nothing is written unclaimed. */
  claim(svixId: string): Promise<DedupeClaim>
  markDone(svixId: string): Promise<void>
  release(svixId: string): Promise<void>
}

const PENDING_TTL_SECONDS = 60
// Svix retries for about 27 h. A retry after this key expires can write one more row.
const DONE_TTL_SECONDS = 24 * 60 * 60

const keyOf = (svixId: string): string => `email:webhook:${svixId}`

/**
 * Three states per svix-id: absent, `pending` while one request records it, and
 * `done`. Not `withRedisLease`: that runs the work unleased on a Redis error and
 * has no done state. With no Redis at all there is no dedupe.
 */
export function createWebhookDedupe(redis: RedisClient | null): WebhookDedupe {
  if (!redis) {
    return {
      claim: async () => 'claimed',
      markDone: async () => {},
      release: async () => {}
    }
  }

  return {
    async claim(svixId) {
      const key = keyOf(svixId)
      if ((await redis.set(key, 'pending', 'EX', PENDING_TTL_SECONDS, 'NX')) === 'OK') {
        return 'claimed'
      }
      // A key that expired between the two calls reads as pending; the retry claims it.
      return (await redis.get(key)) === 'done' ? 'done' : 'pending'
    },
    async markDone(svixId) {
      await redis.set(keyOf(svixId), 'done', 'EX', DONE_TTL_SECONDS)
    },
    async release(svixId) {
      await redis.del(keyOf(svixId))
    }
  }
}
