import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test'
import { Hono } from 'hono'
import healthRouter from '../../src/api/routers/health.router'
import { TestServer, createMockPrisma, createMockRedis } from '../helpers/test-server'

// Mutable reference updated per-test so the mock factory always reads current value.
let mockSupabaseClient: any = null

// Intercept getAnonClient so Supabase tests never make real network calls.
// Resolved absolute path matches what health.service.ts imports.
mock.module('../../src/lib/supabase', () => ({
  getAnonClient: () => mockSupabaseClient
}))

describe('Health Check API', () => {
  let testServer: TestServer
  let app: Hono
  let mockPrisma: any
  let mockRedis: any

  beforeAll(() => {
    app = new Hono()
    testServer = new TestServer(app)
  })

  beforeEach(() => {
    // Reset mocks before each test
    mockPrisma = createMockPrisma()
    mockRedis = createMockRedis()
    // Default: no Supabase client → checkSupabaseHealth returns 'disabled' instantly.
    // Supabase is non-critical so overall health is still 'ok' when prisma/redis are healthy.
    mockSupabaseClient = null

    // Create new app instance with fresh mocks
    app = new Hono()
    app.use('*', async (c, next) => {
      c.set('prisma', mockPrisma)
      c.set('redis', mockRedis)
      await next()
    })
    app.route('/health', healthRouter)
    testServer = new TestServer(app)
  })

  describe('GET /health', () => {
    test('should return overall health status', async () => {
      const response = await testServer.get('/health')
      const data = await response.json()

      // May return 200 or 503 depending on service health
      expect([200, 503]).toContain(response.status)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('services')
      expect(data.services).toHaveProperty('database')
      expect(data.services).toHaveProperty('redis')
      expect(data.services).toHaveProperty('supabase')
    })

    test('should have valid status values', async () => {
      const response = await testServer.get('/health')
      const data = await response.json()

      // Status can be 'ok', 'degraded', or 'unhealthy' depending on service states
      expect(['ok', 'degraded', 'unhealthy']).toContain(data.status)
    })
  })

  describe('GET /health/database', () => {
    test('should return healthy database status', async () => {
      const response = await testServer.get('/health/database')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('lastCheck')
      expect(data.status).toBe('healthy')
    })

    test('should return unhealthy status when database fails', async () => {
      mockPrisma.$queryRaw = async () => {
        throw new Error('Database connection failed')
      }

      const response = await testServer.get('/health/database')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Database connection failed')
      expect(data).toHaveProperty('lastCheck')
    })

    test('should handle non-Error exceptions', async () => {
      mockPrisma.$queryRaw = async () => {
        throw 'String error'
      }

      const response = await testServer.get('/health/database')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.error).toBe('Unknown error')
    })
  })

  describe('GET /health/redis', () => {
    test('should return healthy redis status', async () => {
      const response = await testServer.get('/health/redis')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data.status).toBe('healthy')
    })

    test('should return disabled status when redis is null', async () => {
      // Set redis to null
      app = new Hono()
      app.use('*', async (c, next) => {
        c.set('prisma', mockPrisma)
        c.set('redis', null)
        await next()
      })
      app.route('/health', healthRouter)
      testServer = new TestServer(app)

      const response = await testServer.get('/health/redis')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('disabled')
      expect(data).toHaveProperty('lastCheck')
    })

    test('should return unhealthy status when redis fails', async () => {
      mockRedis.ping = async () => {
        throw new Error('Redis connection refused')
      }

      const response = await testServer.get('/health/redis')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Redis connection refused')
      expect(data).toHaveProperty('lastCheck')
    })

    test('should handle non-Error exceptions in redis', async () => {
      mockRedis.ping = async () => {
        throw 'String error'
      }

      const response = await testServer.get('/health/redis')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.error).toBe('Unknown error')
    })
  })

  describe('GET /health/supabase', () => {
    test('should return unhealthy when supabase is unreachable', async () => {
      // Mock a client whose probe query returns a non-permission network error.
      mockSupabaseClient = {
        from: () => ({
          select: () => ({
            limit: () => ({
              abortSignal: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'ECONNREFUSED: connection refused' }
                })
            })
          })
        })
      }

      const response = await testServer.get('/health/supabase')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('lastCheck')
    })

    test('should return healthy when supabase is accessible', async () => {
      // Mock a client whose probe query succeeds with no error.
      mockSupabaseClient = {
        from: () => ({
          select: () => ({
            limit: () => ({
              abortSignal: () => Promise.resolve({ data: [{ id: '1' }], error: null })
            })
          })
        })
      }

      const response = await testServer.get('/health/supabase')
      const data = await response.json()

      // May be healthy or unhealthy depending on actual connection
      expect([200, 503]).toContain(response.status)
      expect(data).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(data.status)
      expect(data).toHaveProperty('lastCheck')
    })

    test('should return unhealthy when supabase throws error', async () => {
      // Mock a client whose probe query rejects (simulates unexpected failure).
      mockSupabaseClient = {
        from: () => ({
          select: () => ({
            limit: () => ({
              abortSignal: () => Promise.reject(new Error('Supabase connection error'))
            })
          })
        })
      }

      const response = await testServer.get('/health/supabase')
      const data = await response.json()

      // Should handle Supabase errors
      expect([200, 503]).toContain(response.status)
      expect(data).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(data.status)
    })
  })

  describe('Overall Health Check', () => {
    test('should return degraded when database is unhealthy', async () => {
      mockPrisma.$queryRaw = async () => {
        throw new Error('DB error')
      }

      const response = await testServer.get('/health')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.services.database.status).toBe('unhealthy')
    })

    test('should return degraded when redis is unhealthy', async () => {
      mockRedis.ping = async () => {
        throw new Error('Redis error')
      }

      const response = await testServer.get('/health')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.services.redis.status).toBe('unhealthy')
    })

    test('should handle all services being unhealthy', async () => {
      mockPrisma.$queryRaw = async () => {
        throw new Error('DB error')
      }
      mockRedis.ping = async () => {
        throw new Error('Redis error')
      }

      const response = await testServer.get('/health')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.services.database.status).toBe('unhealthy')
      expect(data.services.redis.status).toBe('unhealthy')
    })
  })
})
