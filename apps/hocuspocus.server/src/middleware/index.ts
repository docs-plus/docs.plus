import '../types' // For type augmentation

import { type Context, Hono, type Next } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import { HYPERMULTIMEDIA_MOUNT_PATH } from '../api/routers/hypermultimedia.router'
import { config } from '../config/env'
import { CONSUME_TIMEOUT_MS, consumeWithin } from '../lib/consumeWithin'
import { httpLogger } from '../lib/logger'
import { rateLimitFailOpenTotal } from '../lib/metrics'
import { getRedisClient } from '../lib/redis'

const redisClient = getRedisClient()

// Media reads get their own budget rather than an exemption. The route is public
// and every GET is an S3 round trip, so an unbounded one is an amplifier.
// Production runs RATE_LIMIT_MAX=500, so the 25 cold pad loads derived at the
// construction site below become 250 — a browsing session, not a single visit.
export const MEDIA_READ_BUDGET_FACTOR = 10

// Owned by the router, so renaming the mount cannot silently move media reads back
// onto the global budget. The trailing slash is load-bearing: without it a path
// such as `/api/plugins/hypermultimedia-other` would claim the media budget too.
const MEDIA_READ_PATH_PREFIX = `${HYPERMULTIMEDIA_MOUNT_PATH}/`

export const rateLimiter = (options: {
  points: number
  duration: number // seconds
  keyPrefix?: string
  blockDuration?: number // seconds
}) => {
  const { points, duration, keyPrefix = 'rl', blockDuration } = options

  if (!redisClient) {
    httpLogger.warn('Redis not available, rate limiting disabled')
    return async (c: Context, next: Next) => next()
  }

  const limiter = new RateLimiterRedis({
    storeClient: redisClient,
    points,
    duration,
    keyPrefix,
    blockDuration,
    execEvenly: false,
    insuranceLimiter: undefined
  })

  return async (c: Context, next: Next) => {
    const forwardedFor = c.req.header('x-forwarded-for')
    const realIp = c.req.header('x-real-ip')

    // Genuine internal/direct traffic carries no proxy-forwarding headers — Traefik
    // always sets them for external requests, so this signal can't be spoofed from
    // the edge. Never trust a client-supplied x-internal-request / private-range IP.
    if (!forwardedFor && !realIp) {
      return next()
    }

    // x-real-ip is set by Traefik to the true client; fall back to the first XFF hop.
    const ip = realIp || forwardedFor!.split(',')[0]!.trim() || 'unknown'

    // The key holds nothing the caller writes. Keying it on User-Agent too gave a
    // client that increments that header a fresh budget on every request. That
    // keying also minted one Redis key per distinct value, in the same volatile
    // keyspace the claim-check payloads live in.
    const outcome = await consumeWithin(limiter, ip)

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
          { ip, timeoutMs: CONSUME_TIMEOUT_MS },
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
}

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

export const setupMiddleware = (app: Hono) => {
  // First so preflight OPTIONS gets CORS headers.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  // Development allows any origin. Production restricts to ALLOWED_ORIGINS (falling
  // back to APP_URL); never pair a wildcard origin with credentials.
  const isDevelopment = process.env.NODE_ENV === 'development'
  const prodOrigins =
    allowedOrigins.length > 0 ? allowedOrigins : [process.env.APP_URL || 'https://docs.plus']

  app.use(
    '*',
    cors({
      origin: isDevelopment ? (origin) => origin || '*' : prodOrigins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'token', 'X-Requested-With'],
      // Content-Disposition carries the export filename. Without it here the browser
      // hides the header cross-origin and every download lands under a guessed name.
      exposeHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Content-Disposition'
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
    keyPrefix: 'global'
  })

  // One pad load fetches every picture through the media proxy, so a document
  // holding 20 images spent 20 points of the global budget on a cold open. That
  // let about 25 page views exhaust an address, and an office NAT is one address.
  const mediaReadRateLimiter = rateLimiter({
    points: config.security.rateLimitMax * MEDIA_READ_BUDGET_FACTOR,
    duration: 15 * 60,
    keyPrefix: 'media-read'
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

    // The public read only. The POST on this same prefix is an upload, and it
    // stays on the global budget, where its cost belongs.
    if (c.req.method === 'GET' && path.startsWith(MEDIA_READ_PATH_PREFIX)) {
      return mediaReadRateLimiter(c, next)
    }

    return globalRateLimiter(c, next)
  })
}
