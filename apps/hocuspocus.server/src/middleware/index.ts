import '../types' // For type augmentation

import { type Context, Hono, type Next } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import { config } from '../config/env'
import { httpLogger } from '../lib/logger'
import { getRedisClient } from '../lib/redis'

// Use centralized Redis client for rate limiting
const redisClient = getRedisClient()

export const rateLimiter = (options: {
  points: number // Number of requests allowed
  duration: number // Time window in seconds
  keyPrefix?: string
  blockDuration?: number // Optional block duration after limit exceeded
}) => {
  const { points, duration, keyPrefix = 'rl', blockDuration } = options

  // Skip rate limiting if Redis is not available
  if (!redisClient) {
    httpLogger.warn('Redis not available, rate limiting disabled')
    return async (c: Context, next: Next) => next()
  }

  // Create rate limiter instance
  const limiter = new RateLimiterRedis({
    storeClient: redisClient,
    points, // Number of requests
    duration, // Per duration in seconds
    keyPrefix,
    blockDuration, // Block for N seconds after limit exceeded
    execEvenly: false, // Don't spread requests evenly
    insuranceLimiter: undefined // Optional: in-memory fallback if Redis fails
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
    const userAgent = c.req.header('user-agent') || 'unknown'
    const key = `${ip}:${userAgent}`

    try {
      // Consume 1 point
      const rateLimiterRes = await limiter.consume(key, 1)

      // Set standard rate limit headers
      c.header('X-RateLimit-Limit', points.toString())
      c.header('X-RateLimit-Remaining', rateLimiterRes.remainingPoints.toString())
      c.header(
        'X-RateLimit-Reset',
        new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
      )

      return next()
    } catch (rejRes: any) {
      // Rate limit exceeded
      const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000) || duration

      c.header('X-RateLimit-Limit', points.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString())
      c.header('Retry-After', retryAfter.toString())

      return c.json(
        {
          error: 'Too many requests, please try again later',
          retryAfter
        },
        429
      )
    }
  }
}

/**
 * Logs all HTTP requests with:
 * - Request details (method, path, headers, query)
 * - Response details (status, duration)
 * - Error tracking
 * - Structured JSON in production, pretty print in development
 */
export const pinoLogger = () => {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const requestId = c.get('requestId')
    const method = c.req.method
    const path = c.req.path
    const userAgent = c.req.header('user-agent')
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    // Log incoming request
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
      // Log errors
      httpLogger.error({
        msg: 'Request error',
        requestId,
        method,
        path,
        err
      })
      throw err
    }

    // Log response
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

// Setup all middleware
export const setupMiddleware = (app: Hono) => {
  // CORS - Must be first to handle preflight requests
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
      exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400 // 24 hours
    })
  )

  // Security headers (after CORS)
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

  // Production-ready Pino logger
  app.use('*', pinoLogger())

  // Rate limiting (global) - Skip OPTIONS and health check requests.
  // Build the limiter ONCE (not per request) so the RateLimiterRedis instance is reused.
  const globalRateLimiter = rateLimiter({
    points: config.security.rateLimitMax, // Number of requests allowed
    duration: 15 * 60, // 15 minutes in seconds
    keyPrefix: 'global'
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

    return globalRateLimiter(c, next)
  })
}
