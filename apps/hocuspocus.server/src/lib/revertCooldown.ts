import { RateLimiterRedis } from 'rate-limiter-flexible'

import type { RedisClient } from '../types/redis.types'
import { consumeWithin } from './consumeWithin'
import { revertCooldownTotal } from './metrics'

/**
 * One revert per document per window, shared across replicas. A revert runs six
 * whole-document traversals and appends a permanent backup row, and any registered
 * user with write access can send one. Anonymous sign-in is off, so a visitor cannot.
 */
export const REVERT_COOLDOWN_MS = 2000

const REVERT_COOLDOWN_MAX_KEYS = 10_000

export interface RevertCooldown {
  coolingDown: (documentId: string) => Promise<boolean>
}

/**
 * Redis holds the budget so every replica shares one floor; a per-process Map
 * divided the real cooldown by the replica count. The Map survives as the
 * fallback arm, because failing open would leave this path with no limit at all.
 */
export const createRevertCooldown = (redis: RedisClient | null): RevertCooldown => {
  const lastRevertAt = new Map<string, number>()

  const limiter = redis
    ? new RateLimiterRedis({
        storeClient: redis,
        points: 1,
        duration: REVERT_COOLDOWN_MS / 1000,
        keyPrefix: 'revert-cooldown'
      })
    : null

  const localCoolingDown = (documentId: string, now: number): boolean => {
    const previous = lastRevertAt.get(documentId)
    if (previous !== undefined && now - previous < REVERT_COOLDOWN_MS) return true
    // Bounded without a timer: sweep expired keys only once the map is large.
    if (lastRevertAt.size >= REVERT_COOLDOWN_MAX_KEYS) {
      for (const [key, at] of lastRevertAt) {
        if (now - at >= REVERT_COOLDOWN_MS) lastRevertAt.delete(key)
      }
    }
    lastRevertAt.set(documentId, now)
    return false
  }

  const coolingDown = async (documentId: string): Promise<boolean> => {
    // No Redis client at all is a deployment choice, not a fault, so the Map's own
    // verdict is the honest label. The degraded labels below mean the opposite:
    // Redis was asked and did not answer.
    if (!limiter) {
      const limited = localCoolingDown(documentId, Date.now())
      revertCooldownTotal.inc({ outcome: limited ? 'limited' : 'allowed' })
      return limited
    }

    const outcome = await consumeWithin(limiter, documentId)

    // The opposite of `middleware/index.ts`, on purpose: that middleware fails open
    // and admits the request, while this path falls back to the Map, which still
    // limits. A revert with no limit at all is the failure this guard exists for.
    if (outcome.kind === 'unavailable') {
      revertCooldownTotal.inc({ outcome: `degraded-${outcome.reason}` })
      return localCoolingDown(documentId, Date.now())
    }

    revertCooldownTotal.inc({ outcome: outcome.kind })
    return outcome.kind === 'limited'
  }

  return { coolingDown }
}
