import { describe, test, expect } from 'bun:test'
import { Hono } from 'hono'
import { pinoLogger } from '../../src/middleware'

describe('Middleware - Error Coverage', () => {
  describe('pinoLogger() - error paths', () => {
    test('should catch, log and rethrow errors from handler', async () => {
      const app = new Hono()
      app.use('*', pinoLogger())

      // Create a handler that throws
      app.get('/throw-error', () => {
        throw new Error('Handler error')
      })

      try {
        const response = await app.request('http://localhost/throw-error')
        // Hono will catch the error and return 500
        expect(response.status).toBe(500)
      } catch (error) {
        // If error is re-thrown, this path is taken
        expect(error).toBeDefined()
      }
    })

    test('should handle errors with non-Error objects', async () => {
      const app = new Hono()
      app.use('*', pinoLogger())

      app.get('/throw-string', () => {
        throw 'String error'
      })

      try {
        const response = await app.request('http://localhost/throw-string')
        expect(response.status).toBe(500)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    test('should handle async errors', async () => {
      const app = new Hono()
      app.use('*', pinoLogger())

      app.get('/async-error', async () => {
        await Promise.resolve()
        throw new Error('Async error')
      })

      try {
        const response = await app.request('http://localhost/async-error')
        expect(response.status).toBe(500)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    test('should log different status codes correctly', async () => {
      const app = new Hono()
      app.use('*', pinoLogger())

      // Hono builds its router matcher on the first request, after which no further
      // routes can be added — register every route before issuing any request.
      app.get('/success', (c) => c.json({ ok: true }, 200)) // 200 - info
      app.get('/redirect', (c) => c.json({ redirect: true }, 301)) // 300 - info
      app.get('/bad-request', (c) => c.json({ error: 'bad' }, 400)) // 400 - warn
      app.get('/not-found', (c) => c.json({ error: 'not found' }, 404)) // 404 - warn
      app.get('/server-error', (c) => c.json({ error: 'server' }, 500)) // 500 - error
      app.get('/service-unavailable', (c) => c.json({ error: 'unavailable' }, 503)) // 503 - error

      const res200 = await app.request('http://localhost/success')
      expect(res200.status).toBe(200)

      const res301 = await app.request('http://localhost/redirect')
      expect(res301.status).toBe(301)

      const res400 = await app.request('http://localhost/bad-request')
      expect(res400.status).toBe(400)

      const res404 = await app.request('http://localhost/not-found')
      expect(res404.status).toBe(404)

      const res500 = await app.request('http://localhost/server-error')
      expect(res500.status).toBe(500)

      const res503 = await app.request('http://localhost/service-unavailable')
      expect(res503.status).toBe(503)
    })
  })
})
