import '../types' // For type augmentation

import { type Context, Hono, type Next } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import { HYPERMULTIMEDIA_MOUNT_PATH } from '../api/routers/hypermultimedia.router'
import { config } from '../config/env'
import { CONSUME_TIMEOUT_MS, consumeWithin, readWithin } from '../lib/consumeWithin'
import { httpLogger } from '../lib/logger'
import { rateLimitFailOpenTotal } from '../lib/metrics'
import { getRedisClient } from '../lib/redis'
import { isMarkdownReadPath } from '../modules/document-conversion'
import {
  LINK_ARCHIVE_PATH,
  LINK_ICON_PATH,
  LINK_IMAGE_PATH,
  LINK_METADATA_MOUNT_PATH
} from '../modules/link-metadata'
import { isSocialCardPath } from '../modules/social-card'
import type { RedisClient } from '../types/redis.types'

const redisClient = getRedisClient()

// Per-user duplicate budget (#820): bounds S3 copy amplification (32 objects x 10 MiB)
// once any non-anonymous signed-in user can duplicate public or Open documents.
export const DUPLICATE_RATE_LIMIT_POINTS = 10
export const DUPLICATE_RATE_LIMIT_DURATION_S = 15 * 60

// Dedicated IP budget for public Markdown reads (#822), separate from the global
// pool so coding-agent traffic cannot exhaust a shared office NAT's pad budget.
export const MARKDOWN_READ_RATE_LIMIT_POINTS = 60
export const MARKDOWN_READ_RATE_LIMIT_DURATION_S = 60

// Media reads get their own budget rather than an exemption. The route is public
// and every GET is an S3 round trip, so an unbounded one is an amplifier.
// Production runs RATE_LIMIT_MAX=500, so the 25 cold pad loads derived at the
// construction site below become 250 — a browsing session, not a single visit.
export const MEDIA_READ_BUDGET_FACTOR = 10

// Owned by the router, so renaming the mount cannot silently move media reads back
// onto the global budget. The trailing slash is load-bearing: without it a path
// such as `/api/plugins/hypermultimedia-other` would claim the media budget too.
const MEDIA_READ_PATH_PREFIX = `${HYPERMULTIMEDIA_MOUNT_PATH}/`

// One cold pad spends one point per distinct link origin, so a link-heavy page
// would eat the global budget in a few loads.
const LINK_ICON_BUDGET_FACTOR = 10

// The metadata, image and archive routes share this bucket, so a hovercard spends up to
// two points per link, and a click on "View archived copy" one more. On the global bucket
// a 429 there would also break pad and chat REST calls from the same address.
const LINK_METADATA_BUDGET_FACTOR = 10

// Crawlers fetch the card from their own addresses, and one shared link brings several.
const SOCIAL_CARD_BUDGET_FACTOR = 4

// Genuine internal/direct traffic carries no proxy-forwarding headers — Traefik
// always sets them for external requests, so this signal can't be spoofed from
// the edge. Never trust a client-supplied x-internal-request / private-range IP.
const clientAddress = (c: Context): string | null => {
  const forwardedFor = c.req.header('x-forwarded-for')
  const realIp = c.req.header('x-real-ip')
  if (!forwardedFor && !realIp) return null
  // x-real-ip is set by Traefik to the true client; fall back to the first XFF hop.
  return realIp || forwardedFor!.split(',')[0]!.trim() || 'unknown'
}

const applyRateLimit = async (
  c: Context,
  next: Next,
  limiter: RateLimiterRedis,
  key: string,
  { points, duration, keyPrefix }: { points: number; duration: number; keyPrefix: string }
) => {
  // The key holds nothing the caller writes. Keying it on User-Agent too gave a
  // client that increments that header a fresh budget on every request. That
  // keying also minted one Redis key per distinct value, in the same volatile
  // keyspace the claim-check payloads live in.
  const outcome = await consumeWithin(limiter, key)

  if (outcome.kind === 'unavailable') {
    // The limiter is failing open, which is deliberate for a public REST route.
    // `lib/revertCooldown.ts` answers the same outcome the opposite way, on purpose.
    // No latency alert fires at this speed and no rule matches a level-40 warn,
    // so the counter is the only aggregate trace.
    rateLimitFailOpenTotal.inc({ reason: outcome.reason, bucket: keyPrefix })

    if (outcome.reason === 'store-error') {
      // Read as a rejection it made every rate-limited route fail for as long as
      // Redis was down, while /health — exempt from this middleware — stayed
      // green. Let the request through.
      httpLogger.error({ err: outcome.error }, 'Rate limiter store failed, allowing the request')
    } else {
      httpLogger.warn(
        { key, timeoutMs: CONSUME_TIMEOUT_MS },
        'Rate limiter timed out, allowing the request'
      )
    }

    return next()
  }

  if (outcome.kind === 'limited') {
    const retryAfter = Math.ceil(outcome.res.msBeforeNext / 1000) || duration

    c.header('X-RateLimit-Limit', points.toString())
    c.header('X-RateLimit-Remaining', '0')
    c.header('X-RateLimit-Reset', new Date(Date.now() + outcome.res.msBeforeNext).toISOString())
    c.header('Retry-After', retryAfter.toString())

    // House envelope. The retry seconds live in `Retry-After` only: `error.details`
    // is stripped outside development, so a body field would vanish in production.
    return c.json(
      {
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED'
        }
      },
      429
    )
  }

  c.header('X-RateLimit-Limit', points.toString())
  c.header('X-RateLimit-Remaining', outcome.res.remainingPoints.toString())
  c.header('X-RateLimit-Reset', new Date(Date.now() + outcome.res.msBeforeNext).toISOString())

  return next()
}

export const rateLimiter = (options: {
  points: number
  duration: number // seconds
  keyPrefix?: string
  blockDuration?: number // seconds
  storeClient?: RedisClient | null
}) => {
  const { points, duration, keyPrefix = 'rl', blockDuration } = options
  const storeClient = options.storeClient === undefined ? redisClient : options.storeClient

  if (!storeClient) {
    httpLogger.warn('Redis not available, rate limiting disabled')
    return Object.assign(async (c: Context, next: Next) => next(), {
      hasBudget: async (_c: Context) => true
    })
  }

  const limiter = new RateLimiterRedis({
    storeClient,
    points,
    duration,
    keyPrefix,
    blockDuration,
    execEvenly: false,
    insuranceLimiter: undefined
  })

  // Reads the bucket without spending it. A slow or failing Redis reads as budget
  // left, the same fail-open answer the consume below gives, and counts the same way.
  const hasBudget = async (c: Context): Promise<boolean> => {
    const ip = clientAddress(c)
    if (ip === null) return true
    const outcome = await readWithin(limiter, ip)
    if (outcome.kind === 'unavailable') {
      rateLimitFailOpenTotal.inc({ reason: outcome.reason, bucket: keyPrefix })
      return true
    }
    return outcome.res === null || outcome.res.remainingPoints > 0
  }

  const middleware = async (c: Context, next: Next) => {
    const ip = clientAddress(c)
    if (ip === null) {
      return next()
    }
    return applyRateLimit(c, next, limiter, ip, { points, duration, keyPrefix })
  }

  return Object.assign(middleware, { hasBudget })
}

/** Per-user Redis rate limiter; runs after `requireUser` so `c.get('userId')` is verified. */
export const userRateLimiter = (options: {
  points: number
  duration: number // seconds
  keyPrefix?: string
  blockDuration?: number // seconds
  storeClient?: RedisClient | null
}) => {
  const { points, duration, keyPrefix = 'rl-user', blockDuration } = options
  const storeClient = options.storeClient === undefined ? redisClient : options.storeClient

  if (!storeClient) {
    httpLogger.warn({ keyPrefix }, 'Redis not available, per-user rate limiting disabled')
    return async (_c: Context, next: Next) => next()
  }

  const limiter = new RateLimiterRedis({
    storeClient,
    points,
    duration,
    keyPrefix,
    blockDuration,
    execEvenly: false,
    insuranceLimiter: undefined
  })

  return async (c: Context, next: Next) => {
    const userId = c.get('userId') as string | undefined
    if (!userId) return next()
    return applyRateLimit(c, next, limiter, userId, { points, duration, keyPrefix })
  }
}

export const createDuplicateRateLimiter = (storeClient?: RedisClient | null) =>
  userRateLimiter({
    points: DUPLICATE_RATE_LIMIT_POINTS,
    duration: DUPLICATE_RATE_LIMIT_DURATION_S,
    keyPrefix: 'doc-duplicate',
    storeClient
  })

export const pinoLogger = () => {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const requestId = c.get('requestId')
    const method = c.req.method
    const path = c.req.path
    const userAgent = c.req.header('user-agent')
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    httpLogger.info({
      msg: 'Incoming request',
      requestId,
      method,
      path,
      ip,
      userAgent
    })

    try {
      await next()
    } catch (err) {
      httpLogger.error({
        msg: 'Request error',
        requestId,
        method,
        path,
        err
      })
      throw err
    }

    const duration = Date.now() - start
    const status = c.res.status

    let logLevel: 'error' | 'warn' | 'info' = 'info'
    if (status >= 500) {
      logLevel = 'error'
    } else if (status >= 400) {
      logLevel = 'warn'
    }

    httpLogger[logLevel]({
      msg: 'Request completed',
      requestId,
      method,
      path,
      status,
      duration: `${duration}ms`,
      ip
    })
  }
}

export type McpRateLimitDecision =
  | { kind: 'verified' }
  | { kind: 'limited'; response: Response }
  | { kind: 'auth-unavailable' }
  | { kind: 'fallthrough' }

export interface MiddlewareOptions {
  /**
   * Evaluates `/api/mcp` transport calls: verified OAuth callers spend `mcp-req` once
   * and skip the global limiter; Auth 503s charge `mcp-auth-503`.
   */
  mcpRateLimit: (c: Context, hasBudget: () => Promise<boolean>) => Promise<McpRateLimitDecision>
  /** Optional Redis client override for tests; defaults to the shared Redis client. */
  storeClient?: RedisClient | null
}

export const setupMiddleware = (app: Hono, opts: MiddlewareOptions) => {
  // First so preflight OPTIONS gets CORS headers.
  // Development allows any origin. Production restricts to the resolved allowlist;
  // never pair a wildcard origin with credentials.
  const isDevelopment = process.env.NODE_ENV === 'development'
  const prodOrigins = config.security.originAllowlist

  app.use(
    '*',
    cors({
      origin: isDevelopment ? (origin) => origin || '*' : prodOrigins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      // Mcp-Protocol-Version serves browser MCP clients, such as the inspector.
      // Server-side hosts send no Origin, so CORS never reaches them.
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'token',
        'X-Requested-With',
        'Mcp-Protocol-Version',
        'MCP-Method',
        'MCP-Name',
        'Mcp-Session-Id',
        'Last-Event-ID'
      ],
      // Content-Disposition carries the export filename. Without it here the browser
      // hides the header cross-origin and every download lands under a guessed name.
      // WWW-Authenticate is how a browser MCP client finds the OAuth metadata.
      exposeHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Content-Disposition',
        'WWW-Authenticate',
        'Retry-After'
      ],
      maxAge: 86400
    })
  )

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:']
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false
    })
  )

  app.use('*', pinoLogger())

  // Build the limiter ONCE (not per request) so the RateLimiterRedis instance is reused.
  const globalRateLimiter = rateLimiter({
    points: config.security.rateLimitMax,
    duration: 15 * 60,
    keyPrefix: 'global',
    storeClient: opts.storeClient
  })

  // One pad load fetches every picture through the media proxy, so a document
  // holding 20 images spent 20 points of the global budget on a cold open. That
  // let about 25 page views exhaust an address, and an office NAT is one address.
  const mediaReadRateLimiter = rateLimiter({
    points: config.security.rateLimitMax * MEDIA_READ_BUDGET_FACTOR,
    duration: 15 * 60,
    keyPrefix: 'media-read',
    storeClient: opts.storeClient
  })
  const linkIconRateLimiter = rateLimiter({
    points: config.security.rateLimitMax * LINK_ICON_BUDGET_FACTOR,
    duration: 15 * 60,
    keyPrefix: 'metadata-icon',
    storeClient: opts.storeClient
  })
  const linkMetadataRateLimiter = rateLimiter({
    points: config.security.rateLimitMax * LINK_METADATA_BUDGET_FACTOR,
    duration: 15 * 60,
    keyPrefix: 'link-metadata',
    storeClient: opts.storeClient
  })
  const socialCardRateLimiter = rateLimiter({
    points: config.security.rateLimitMax * SOCIAL_CARD_BUDGET_FACTOR,
    duration: 15 * 60,
    keyPrefix: 'social-card',
    storeClient: opts.storeClient
  })
  const markdownReadRateLimiter = rateLimiter({
    points: MARKDOWN_READ_RATE_LIMIT_POINTS,
    duration: MARKDOWN_READ_RATE_LIMIT_DURATION_S,
    keyPrefix: 'doc-markdown',
    storeClient: opts.storeClient
  })
  const mcpAuth503RateLimiter = rateLimiter({
    points: 100,
    duration: 60,
    keyPrefix: 'mcp-auth-503',
    storeClient: opts.storeClient
  })
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return next()
    }

    // Skip rate limiting for health check endpoints (Traefik, k8s probes, etc.)
    const path = new URL(c.req.url).pathname
    if (path === '/health' || path.startsWith('/health/')) {
      return next()
    }

    // No method check: Hono runs a HEAD through the GET route, so HEAD spends this budget too.
    if (path === LINK_ICON_PATH) {
      return linkIconRateLimiter(c, next)
    }
    if (
      path === LINK_METADATA_MOUNT_PATH ||
      path === LINK_IMAGE_PATH ||
      path === LINK_ARCHIVE_PATH
    ) {
      return linkMetadataRateLimiter(c, next)
    }
    if (isSocialCardPath(path)) {
      return socialCardRateLimiter(c, next)
    }
    if (isMarkdownReadPath(path)) {
      return markdownReadRateLimiter(c, next)
    }

    // The public read only. The POST on this same prefix is an upload, and it
    // stays on the global budget, where its cost belongs.
    if (c.req.method === 'GET' && path.startsWith(MEDIA_READ_PATH_PREFIX)) {
      return mediaReadRateLimiter(c, next)
    }

    // Verified MCP calls skip the global limiter while the address has budget left (#551, #811).
    // Auth outages charge `mcp-auth-503` (100/60 s per IP) instead of the global 15-min bucket.
    const mcpDecision = await opts.mcpRateLimit(c, () => globalRateLimiter.hasBudget(c))
    if (mcpDecision.kind === 'limited') {
      return mcpDecision.response
    }
    if (mcpDecision.kind === 'verified') {
      return next()
    }
    if (mcpDecision.kind === 'auth-unavailable') {
      return mcpAuth503RateLimiter(c, next)
    }

    return globalRateLimiter(c, next)
  })
}
