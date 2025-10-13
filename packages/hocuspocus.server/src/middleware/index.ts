import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import chalk from 'chalk'
import type { RedisClient } from '../types'

// Rate limiter middleware using Redis
export const rateLimiter = (options: { max: number; window: number; keyPrefix?: string }) => {
  const { max, window, keyPrefix = 'rate-limit' } = options

  return async (c: Context, next: Next) => {
    const redis = c.get('redis') as RedisClient | null

    if (!redis) {
      // If Redis is not available, skip rate limiting
      return next()
    }

    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || 'unknown'
    const key = `${keyPrefix}:${ip}:${userAgent}`

    try {
      const requests = await redis.incr(key)

      if (requests === 1) {
        await redis.pexpire(key, window)
      }

      const ttl = await redis.pttl(key)

      c.header('X-RateLimit-Limit', max.toString())
      c.header('X-RateLimit-Remaining', Math.max(0, max - requests).toString())
      c.header('X-RateLimit-Reset', new Date(Date.now() + ttl).toISOString())

      if (requests > max) {
        return c.json({ error: 'Too many requests, please try again later' }, 429)
      }
    } catch (error) {
      console.error('Rate limiter error:', error)
      // On error, allow the request to proceed
    }

    return next()
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
      max: rateLimitMax,
      window: 15 * 60 * 1000 // 15 minutes
    })(c, next)
  })
}
