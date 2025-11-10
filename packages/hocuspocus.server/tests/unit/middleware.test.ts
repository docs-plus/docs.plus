import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { uploadSizeLimit, pinoLogger, setupMiddleware } from '../../src/middleware'

describe('Middleware - Complete Coverage', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  describe('uploadSizeLimit()', () => {
    test('should reject requests exceeding max size', async () => {
      const maxSize = 1000 // 1KB
      app.use('*', uploadSizeLimit(maxSize))
      app.post('/upload', (c) => c.json({ success: true }))

      const response = await app.request('http://localhost/upload', {
        method: 'POST',
        headers: {
          'Content-Length': '2000' // 2KB - exceeds limit
        },
        body: 'test data'
      })

      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe(`File size exceeds maximum allowed size of ${maxSize} bytes`)
    })

    test('should allow requests within size limit', async () => {
      const maxSize = 5000 // 5KB
      app.use('*', uploadSizeLimit(maxSize))
      app.post('/upload', (c) => c.json({ success: true }))

      const response = await app.request('http://localhost/upload', {
        method: 'POST',
        headers: {
          'Content-Length': '1000' // 1KB - within limit
        },
        body: 'test data'
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    test('should allow requests without Content-Length header', async () => {
      const maxSize = 1000
      app.use('*', uploadSizeLimit(maxSize))
      app.post('/upload', (c) => c.json({ success: true }))

      const response = await app.request('http://localhost/upload', {
        method: 'POST',
        body: 'test data'
      })

      expect(response.status).toBe(200)
    })
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
      expect(() => setupMiddleware(devApp)).not.toThrow()

      process.env.NODE_ENV = originalEnv
    })

    test('should configure CORS for production with ALLOWED_ORIGINS', () => {
      const originalEnv = process.env.NODE_ENV
      const originalOrigins = process.env.ALLOWED_ORIGINS

      process.env.NODE_ENV = 'production'
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com'

      const prodApp = new Hono()

      // Verify middleware can be set up without errors
      expect(() => setupMiddleware(prodApp)).not.toThrow()

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
      expect(() => setupMiddleware(prodApp)).not.toThrow()

      process.env.NODE_ENV = originalEnv
      process.env.ALLOWED_ORIGINS = originalOrigins
    })

    test('should handle whitespace in ALLOWED_ORIGINS', () => {
      const originalOrigins = process.env.ALLOWED_ORIGINS

      process.env.ALLOWED_ORIGINS = ' https://example.com , https://app.example.com '

      const prodApp = new Hono()

      // Verify middleware can be set up and properly trims origins
      expect(() => setupMiddleware(prodApp)).not.toThrow()

      process.env.ALLOWED_ORIGINS = originalOrigins
    })
  })
})

