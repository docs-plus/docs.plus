import type { Logger } from 'pino'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import { consumeWithin } from '../../../lib/consumeWithin'
import { rateLimitFailOpenTotal } from '../../../lib/metrics'
import type { RedisClient } from '../../../types/redis.types'
import type { CallerBudget } from '../types'

const MCP_CALLS_PER_MINUTE = 60
// Well above the tool budget: a host may send `initialize` or `tools/list` around each tool
// call. It bounds abuse far below the edge limit, not normal use.
const MCP_REQUESTS_PER_MINUTE = 300
const CLIENT_REDIRECTS_PER_MINUTE = 30

/**
 * Keyed on the subject, never the address: every hosted Claude call arrives
 * from one Anthropic range. Fails open, like the global limiter.
 */
const createCallerBudget = (
  redis: RedisClient | null,
  logger: Logger,
  points: number,
  keyPrefix: string
): CallerBudget => {
  if (!redis) return async () => ({ ok: true })

  const limiter = new RateLimiterRedis({ storeClient: redis, points, duration: 60, keyPrefix })

  return async (sub) => {
    const outcome = await consumeWithin(limiter, sub)
    if (outcome.kind === 'limited') {
      return { ok: false, retryAfter: Math.ceil(outcome.res.msBeforeNext / 1000) || 60 }
    }
    if (outcome.kind === 'unavailable') {
      rateLimitFailOpenTotal.inc({ reason: outcome.reason, bucket: keyPrefix })
      logger.warn(
        { reason: outcome.reason, keyPrefix },
        'MCP budget unavailable, allowing the call'
      )
    }
    return { ok: true }
  }
}

/** Spent inside each tool's `run` wrapper. */
export const createToolBudget = (redis: RedisClient | null, logger: Logger): CallerBudget =>
  createCallerBudget(redis, logger, MCP_CALLS_PER_MINUTE, 'mcp-sub')

/** Spent by every authenticated transport request, `initialize` and `tools/list` included (#551). */
export const createRequestBudget = (redis: RedisClient | null, logger: Logger): CallerBudget =>
  createCallerBudget(redis, logger, MCP_REQUESTS_PER_MINUTE, 'mcp-req')

/** Per-user cap on single-client redirect lookups to bound Supabase Admin API calls. */
export const createClientRedirectsBudget = (
  redis: RedisClient | null,
  logger: Logger
): CallerBudget =>
  createCallerBudget(redis, logger, CLIENT_REDIRECTS_PER_MINUTE, 'mcp-client-redirects')
