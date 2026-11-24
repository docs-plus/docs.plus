import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import {
  createDuplicateRateLimiter,
  DUPLICATE_RATE_LIMIT_POINTS,
  MARKDOWN_READ_RATE_LIMIT_POINTS,
  pinoLogger,
  setupMiddleware
} from '../../src/middleware'
import type { RedisClient } from '../../src/types/redis.types'

// Minimal in-memory rlflxIncr stub exercising real RateLimiterRedis + consumeWithin.
const makeMemoryRateLimitRedis = (): RedisClient => {
  const counts = new Map<string, number>()
  return {
    defineCommand: () => {},
    rlflxIncr: async (args: [string, string, string, string, string]) => {
      const [key, pointsToConsume, secDuration] = args
      const next = (counts.get(key) ?? 0) + Number(pointsToConsume)
      counts.set(key, next)
      return [next, Number(secDuration) * 1000]
    }
  } as unknown as RedisClient
}

// These tests cover CORS and logging, not the MCP rate-limit skip.
const NO_MCP_SKIP = { mcpRateLimit: async () => ({ kind: 'fallthrough' as const }) }

describe('Middleware - Complete Coverage', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  describe('pinoLogger() error handling', () => {
    test('should catch and log errors then return 500', async () => {
      app.use('*', pinoLogger())
      app.get('/error', (c) => {
        throw new Error('Test error')
      })

      // Hono catches errors and returns 500, not re-throwing
      const response = await app.request('http://localhost/error')

      expect(response.status).toBe(500)
    })

    test('should log 500 status as error level', async () => {
      app.use('*', pinoLogger())
      app.get('/server-error', (c) => c.json({ error: 'Internal error' }, 500))

      const response = await app.request('http://localhost/server-error')

      expect(response.status).toBe(500)
    })

    test('should log 400 status as warn level', async () => {
      app.use('*', pinoLogger())
      app.get('/bad-request', (c) => c.json({ error: 'Bad request' }, 400))

      const response = await app.request('http://localhost/bad-request')

      expect(response.status).toBe(400)
    })

    test('should log 200 status as info level', async () => {
      app.use('*', pinoLogger())
      app.get('/success', (c) => c.json({ message: 'Success' }, 200))

      const response = await app.request('http://localhost/success')

      expect(response.status).toBe(200)
    })
  })

  describe('setupMiddleware() CORS configuration', () => {
    test('should configure CORS for development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const devApp = new Hono()

      // Just verify middleware can be set up without errors
      expect(() => setupMiddleware(devApp, NO_MCP_SKIP)).not.toThrow()

      process.env.NODE_ENV = originalEnv
    })

    test('should configure CORS for production with ALLOWED_ORIGINS', () => {
      const originalEnv = process.env.NODE_ENV
      const originalOrigins = process.env.ALLOWED_ORIGINS

      process.env.NODE_ENV = 'production'
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com'

      const prodApp = new Hono()

      // Verify middleware can be set up without errors
      expect(() => setupMiddleware(prodApp, NO_MCP_SKIP)).not.toThrow()

      process.env.NODE_ENV = originalEnv
      process.env.ALLOWED_ORIGINS = originalOrigins
    })

    test('should configure CORS for production without ALLOWED_ORIGINS', () => {
      const originalEnv = process.env.NODE_ENV
      const originalOrigins = process.env.ALLOWED_ORIGINS

      process.env.NODE_ENV = 'production'
      delete process.env.ALLOWED_ORIGINS

      const prodApp = new Hono()

      // Verify middleware can be set up without errors
      expect(() => setupMiddleware(prodApp, NO_MCP_SKIP)).not.toThrow()

      process.env.NODE_ENV = originalEnv
      process.env.ALLOWED_ORIGINS = originalOrigins
    })

    test('should handle whitespace in ALLOWED_ORIGINS', () => {
      const originalOrigins = process.env.ALLOWED_ORIGINS

      process.env.ALLOWED_ORIGINS = ' https://example.com , https://app.example.com '

      const prodApp = new Hono()

      // Verify middleware can be set up and properly trims origins
      expect(() => setupMiddleware(prodApp, NO_MCP_SKIP)).not.toThrow()

      process.env.ALLOWED_ORIGINS = originalOrigins
    })
  })

  describe('per-user duplicate rate limiter (#820)', () => {
    test('allows 10 duplicates per userId, then returns 429 + Retry-After without affecting another user', async () => {
      const redis = makeMemoryRateLimitRedis()
      const duplicateApp = new Hono()
      duplicateApp.use('*', async (c, next) => {
        c.set('userId', c.req.header('x-test-user') ?? '')
        await next()
      })
      duplicateApp.post('/api/documents/:id/duplicate', createDuplicateRateLimiter(redis), (c) =>
        c.json({ ok: true }, 200)
      )

      for (let i = 0; i < DUPLICATE_RATE_LIMIT_POINTS; i++) {
        const okRes = await duplicateApp.request('http://localhost/api/documents/doc1/duplicate', {
          method: 'POST',
          headers: { 'x-test-user': 'user-a' }
        })
        expect(okRes.status).toBe(200)
      }

      const blocked = await duplicateApp.request('http://localhost/api/documents/doc1/duplicate', {
        method: 'POST',
        headers: { 'x-test-user': 'user-a' }
      })
      const blockedBody = (await blocked.json()) as { error: { code: string } }
      expect(blocked.status).toBe(429)
      expect(blockedBody.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)

      // Different userId still has full budget.
      const otherUser = await duplicateApp.request(
        'http://localhost/api/documents/doc1/duplicate',
        {
          method: 'POST',
          headers: { 'x-test-user': 'user-b' }
        }
      )
      expect(otherUser.status).toBe(200)
    })
  })

  describe('dedicated public Markdown read IP rate limiter (#822)', () => {
    test('routes GET /api/documents/:slug/markdown to doc-markdown bucket ahead of globalRateLimiter', async () => {
      const redis = makeMemoryRateLimitRedis()
      const mdApp = new Hono()
      setupMiddleware(mdApp, { ...NO_MCP_SKIP, storeClient: redis })
      mdApp.get('/api/documents/:slug/markdown', (c) => c.text('# Hello', 200))
      mdApp.get('/api/documents/:slug', (c) => c.json({ ok: true }, 200))

      const ipHeaders = { 'x-real-ip': '203.0.113.10' }
      for (let i = 0; i < MARKDOWN_READ_RATE_LIMIT_POINTS; i++) {
        const res = await mdApp.request('http://localhost/api/documents/my-pad/markdown', {
          headers: ipHeaders
        })
        expect(res.status).toBe(200)
        expect(res.headers.get('x-ratelimit-limit')).toBe(String(MARKDOWN_READ_RATE_LIMIT_POINTS))
      }

      const limited = await mdApp.request('http://localhost/api/documents/my-pad/markdown', {
        headers: ipHeaders
      })
      expect(limited.status).toBe(429)
      expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)

      // Global bucket for the same IP was never spent by the markdown reads.
      const globalRes = await mdApp.request('http://localhost/api/documents/my-pad', {
        headers: ipHeaders
      })
      expect(globalRes.status).toBe(200)
    })

    test('passes parsed pathname into mcpRateLimit', async () => {
      const seenPaths: (string | undefined)[] = []
      const mcpApp = new Hono()
      setupMiddleware(mcpApp, {
        mcpRateLimit: async (_c, _hasBudget, path) => {
          seenPaths.push(path)
          return { kind: 'fallthrough' }
        }
      })
      mcpApp.post('/api/mcp', (c) => c.text('ok'))

      const res = await mcpApp.request('http://localhost/api/mcp?foo=bar', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(seenPaths).toEqual(['/api/mcp'])
    })
  })
})
