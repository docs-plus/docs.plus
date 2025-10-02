import { describe, test, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { setupMiddleware } from '../../src/middleware'
import { TestServer } from '../helpers/test-server'

describe('CORS Middleware', () => {
  let testServer: TestServer
  let app: Hono

  beforeAll(() => {
    // Set development environment
    process.env.NODE_ENV = 'development'

    app = new Hono()
    setupMiddleware(app)

    // Add test routes
    app.get('/test', (c) => c.json({ message: 'success' }))
    app.post('/test', async (c) => {
      const body = await c.req.json()
      return c.json({ received: body })
    })
    app.put('/test/:id', async (c) => {
      const body = await c.req.json()
      return c.json({ id: c.req.param('id'), updated: body })
    })
    app.delete('/test/:id', (c) => c.json({ deleted: c.req.param('id') }))

    testServer = new TestServer(app)
  })

  describe('Preflight OPTIONS requests', () => {
    test('should handle OPTIONS request with CORS headers', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      })

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy()
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy()
    })

    test('should allow credentials', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000'
        }
      })

      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    test('should have appropriate max-age for preflight cache', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000'
        }
      })

      const maxAge = response.headers.get('Access-Control-Max-Age')
      expect(maxAge).toBeTruthy()
      expect(parseInt(maxAge || '0', 10)).toBeGreaterThan(0)
    })
  })

  describe('Actual requests with CORS', () => {
    test('should allow GET requests from different origin', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()

      const data = await response.json()
      expect(data.message).toBe('success')
    })

    test('should allow POST requests from different origin', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: 'data' })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()

      const data = await response.json()
      expect(data.received.test).toBe('data')
    })

    test('should allow PUT requests from different origin', async () => {
      const response = await testServer.app.request('http://localhost:3001/test/123', {
        method: 'PUT',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'updated' })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()

      const data = await response.json()
      expect(data.id).toBe('123')
    })

    test('should allow DELETE requests from different origin', async () => {
      const response = await testServer.app.request('http://localhost:3001/test/456', {
        method: 'DELETE',
        headers: {
          Origin: 'http://localhost:3000'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    })

    test('should expose rate limit headers', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000'
        }
      })

      const exposedHeaders = response.headers.get('Access-Control-Expose-Headers')
      expect(exposedHeaders).toBeTruthy()
      expect(exposedHeaders).toContain('X-RateLimit')
    })
  })

  describe('Custom headers', () => {
    test('should allow Authorization header', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
          Authorization: 'Bearer token123'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    })

    test('should allow custom token header', async () => {
      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
          token: 'custom-token'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    })
  })

  describe('Rate limiting with CORS', () => {
    test('should not rate limit OPTIONS requests', async () => {
      // Make multiple OPTIONS requests quickly
      const requests = []
      for (let i = 0; i < 10; i++) {
        requests.push(
          testServer.app.request('http://localhost:3001/test', {
            method: 'OPTIONS',
            headers: {
              Origin: 'http://localhost:3000'
            }
          })
        )
      }

      const responses = await Promise.all(requests)

      // All OPTIONS requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(204)
      })
    })
  })

  describe('Development vs Production', () => {
    test('should allow any origin in development', async () => {
      process.env.NODE_ENV = 'development'

      const response = await testServer.app.request('http://localhost:3001/test', {
        method: 'GET',
        headers: {
          Origin: 'http://random-domain.com:1234'
        }
      })

      expect(response.status).toBe(200)
      const allowedOrigin = response.headers.get('Access-Control-Allow-Origin')
      expect(allowedOrigin).toBeTruthy()
    })
  })
})
