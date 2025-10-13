import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import chalk from 'chalk'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'
import '../types' // For type augmentation

// Create dedicated Redis client for rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  lazyConnect: true,
  enableOfflineQueue: false
})


export const rateLimiter = (options: {
  points: number // Number of requests allowed
  duration: number // Time window in seconds
  keyPrefix?: string
  blockDuration?: number // Optional block duration after limit exceeded
}) => {
  const { points, duration, keyPrefix = 'rl', blockDuration } = options

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

// Custom logger with colors
export const customLogger = () => {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const path = c.req.path
    const method = c.req.method

    await next()

    const elapsed = Date.now() - start
    const status = c.res.status

    let statusColor = chalk.green
    if (status >= 400 && status < 500) statusColor = chalk.yellow
    if (status >= 500) statusColor = chalk.red

    console.log(
      `${chalk.cyan('[hono]')} ${chalk.bold(method)} ${path} ${statusColor(status)} - ${chalk.gray(`${elapsed}ms`)}`
    )
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

  // Custom colored logger
  app.use('*', customLogger())

  // Rate limiting (global) - Skip OPTIONS requests
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  app.use('*', async (c, next) => {
    // Skip rate limiting for OPTIONS preflight requests
    if (c.req.method === 'OPTIONS') {
      return next()
    }

    return rateLimiter({
      points: rateLimitMax, // Number of requests allowed
      duration: 15 * 60, // 15 minutes in seconds
      keyPrefix: 'global'
    })(c, next)
  })
}
