import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import { getRedisClient } from '../lib/redis'
import { httpLogger } from '../lib/logger'
import '../types' // For type augmentation

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
    // Get client identifier (IP + User-Agent for better uniqueness)
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || 'unknown'

    // Skip rate limiting for internal Docker network requests (from webapp containers)
    // Internal requests come from Docker network IPs (172.x.x.x, 10.x.x.x) or have internal headers
    const isInternalRequest =
      c.req.header('x-internal-request') === 'true' ||
      (ip &&
        (ip.startsWith('172.') || // Docker default network range
          ip.startsWith('10.') || // Private network range
          ip === '127.0.0.1' ||
          ip === '::1'))

    if (isInternalRequest) {
      return next()
    }

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

// File upload size limit middleware
export const uploadSizeLimit = (maxSize: number) => {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length')

    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      return c.json({ error: `File size exceeds maximum allowed size of ${maxSize} bytes` }, 413)
    }

    return next()
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
    const method = c.req.method
    const path = c.req.path
    const userAgent = c.req.header('user-agent')
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    // Log incoming request
    httpLogger.info({
      msg: 'Incoming request',
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
        method,
        path,
        err
      })
      throw err
    }

    // Log response
    const duration = Date.now() - start
    const status = c.res.status

    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    httpLogger[logLevel]({
      msg: 'Request completed',
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

  // In development, allow all origins. In production, use ALLOWED_ORIGINS
  const isDevelopment = process.env.NODE_ENV === 'development'

  app.use(
    '*',
    cors({
      origin: isDevelopment
        ? (origin) => origin || '*' // Allow any origin in development
        : allowedOrigins.length > 0
          ? allowedOrigins
          : '*',
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

  // Rate limiting (global) - Skip OPTIONS and health check requests
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  app.use('*', async (c, next) => {
    // Skip rate limiting for OPTIONS preflight requests
    if (c.req.method === 'OPTIONS') {
      return next()
    }

    // Skip rate limiting for health check endpoints (Traefik, k8s probes, etc.)
    const path = new URL(c.req.url).pathname
    if (path === '/health' || path.startsWith('/health/')) {
      return next()
    }

    return rateLimiter({
      points: rateLimitMax, // Number of requests allowed
      duration: 15 * 60, // 15 minutes in seconds
      keyPrefix: 'global'
    })(c, next)
  })
}
