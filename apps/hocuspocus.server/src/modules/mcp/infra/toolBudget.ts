import type { Logger } from 'pino'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import { consumeWithin } from '../../../lib/consumeWithin'
import type { RedisClient } from '../../../types/redis.types'
import type { ToolBudget } from '../types'

const MCP_CALLS_PER_MINUTE = 60

/**
 * Keyed on the subject, never the address: every hosted Claude call arrives
 * from one Anthropic range. Fails open, like the global limiter.
 */
export const createToolBudget = (redis: RedisClient | null, logger: Logger): ToolBudget => {
  if (!redis) return async () => ({ ok: true })

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    points: MCP_CALLS_PER_MINUTE,
    duration: 60,
    keyPrefix: 'mcp-sub'
  })

  return async (sub) => {
    const outcome = await consumeWithin(limiter, sub)
    if (outcome.kind === 'limited') {
      return { ok: false, retryAfter: Math.ceil(outcome.res.msBeforeNext / 1000) || 60 }
    }
    if (outcome.kind === 'unavailable') {
      logger.warn({ reason: outcome.reason }, 'MCP tool budget unavailable, allowing the call')
    }
    return { ok: true }
  }
}
