import type { Logger } from 'pino'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import { consumeWithin } from '../../../lib/consumeWithin'
import type { RedisClient } from '../../../types/redis.types'
import type { TestSendBudget } from '../types'

/**
 * One test email per admin per minute. Fails closed, unlike the MCP budget:
 * with no Redis, or a slow one, nothing bounds a click loop on a real send.
 */
export const createTestSendBudget = (redis: RedisClient | null, logger: Logger): TestSendBudget => {
  if (!redis) return async () => 'unavailable'

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    points: 1,
    duration: 60,
    keyPrefix: 'email-test-send'
  })

  return async (userId) => {
    const outcome = await consumeWithin(limiter, userId)
    if (outcome.kind === 'unavailable') {
      logger.warn(
        { reason: outcome.reason },
        'email test-send budget unavailable, refusing the send'
      )
    }
    return outcome.kind
  }
}
