import { describe, test, expect } from 'bun:test'
import { TestServer, createMockPrisma, createMockRedis } from '../helpers/test-server'
import { Hono } from 'hono'

describe('Test Helpers', () => {
  describe('TestServer', () => {
    test('should create test server with default port', () => {
      const app = new Hono()
      const testServer = new TestServer(app)

      expect(testServer).toBeDefined()
      expect(testServer.app).toBe(app)
    })

    test('should create test server with custom port', () => {
      const app = new Hono()
      const testServer = new TestServer(app, 4000)

      expect(testServer).toBeDefined()
      expect(testServer.app).toBe(app)
    })

    test('should make GET requests', async () => {
      const app = new Hono()
      app.get('/test', (c) => c.json({ message: 'GET success' }))

      const testServer = new TestServer(app)
      const response = await testServer.get('/test')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('GET success')
    })

    test('should make GET requests with headers', async () => {
      const app = new Hono()
      app.get('/test', (c) => {
        const auth = c.req.header('Authorization')
        return c.json({ auth })
      })

      const testServer = new TestServer(app)
      const response = await testServer.get('/test', { Authorization: 'Bearer token' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.auth).toBe('Bearer token')
    })

    test('should make POST requests', async () => {
      const app = new Hono()
      app.post('/test', async (c) => {
        const body = await c.req.json()
        return c.json({ received: body })
      })

      const testServer = new TestServer(app)
      const response = await testServer.post('/test', { name: 'test' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received.name).toBe('test')
    })

    test('should make POST requests with custom headers', async () => {
      const app = new Hono()
      app.post('/test', async (c) => {
        const apiKey = c.req.header('X-API-Key')
        return c.json({ apiKey })
      })

      const testServer = new TestServer(app)
      const response = await testServer.post('/test', {}, { 'X-API-Key': 'secret' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.apiKey).toBe('secret')
    })

    test('should make PUT requests', async () => {
      const app = new Hono()
      app.put('/test/:id', async (c) => {
        const body = await c.req.json()
        const id = c.req.param('id')
        return c.json({ id, updated: body })
      })

      const testServer = new TestServer(app)
      const response = await testServer.put('/test/123', { name: 'updated' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('123')
      expect(data.updated.name).toBe('updated')
    })

    test('should make DELETE requests', async () => {
      const app = new Hono()
      app.delete('/test/:id', (c) => {
        const id = c.req.param('id')
        return c.json({ deleted: id })
      })

      const testServer = new TestServer(app)
      const response = await testServer.delete('/test/456')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.deleted).toBe('456')
    })

    test('should upload files', async () => {
      const app = new Hono()
      app.post('/upload', async (c) => {
        const formData = await c.req.formData()
        const file = formData.get('mediaFile') as File
        return c.json({ fileName: file?.name, size: file?.size })
      })

      const testServer = new TestServer(app)
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const response = await testServer.upload('/upload', file)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.fileName).toBe('test.txt')
    })

    test('should upload files with custom field name', async () => {
      const app = new Hono()
      app.post('/upload', async (c) => {
        const formData = await c.req.formData()
        const file = formData.get('customField') as File
        return c.json({ fileName: file?.name })
      })

      const testServer = new TestServer(app)
      const file = new File(['test'], 'custom.txt', { type: 'text/plain' })
      const response = await testServer.upload('/upload', file, 'customField')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.fileName).toBe('custom.txt')
    })

    test('should get response text', async () => {
      const app = new Hono()
      app.get('/text', (c) => c.text('Plain text response'))

      const testServer = new TestServer(app)
      const response = await testServer.get('/text')
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('Plain text response')
    })
  })

  describe('createMockPrisma', () => {
    test('should create mock Prisma client', () => {
      const prisma = createMockPrisma()

      expect(prisma).toBeDefined()
      expect(prisma.documentMetadata).toBeDefined()
      expect(prisma.documents).toBeDefined()
      expect(prisma.$queryRaw).toBeDefined()
      expect(prisma.$disconnect).toBeDefined()
    })

    test('should have documentMetadata methods', async () => {
      const prisma = createMockPrisma()

      expect(await prisma.documentMetadata?.findUnique()).toBeNull()
      expect(await prisma.documentMetadata?.findMany()).toEqual([])
      expect(await prisma.documentMetadata?.count()).toBe(0)
    })

    test('should create documents', async () => {
      const prisma = createMockPrisma()
      const result = await prisma.documentMetadata?.create({ data: { title: 'Test' } } as any)

      expect(result).toHaveProperty('id')
      expect(result?.id).toBe(1)
      expect(result).toHaveProperty('title')
      expect(result?.title).toBe('Test')
    })

    test('should upsert documents', async () => {
      const prisma = createMockPrisma()
      const result = await prisma.documentMetadata?.upsert({
        where: { id: 1 },
        create: { title: 'New' },
        update: { title: 'Updated' }
      } as any)

      expect(result).toHaveProperty('id')
      expect(result?.title).toBe('New')
    })

    test('should execute raw queries', async () => {
      const prisma = createMockPrisma()
      const result = await prisma.$queryRaw?.([] as any)

      expect(result).toEqual([{ result: 1 }])
    })

    test('should disconnect', async () => {
      const prisma = createMockPrisma()
      const result = await prisma.$disconnect?.()

      expect(result).toBeUndefined()
    })
  })

  describe('createMockRedis', () => {
    test('should create mock Redis client', () => {
      const redis = createMockRedis()

      expect(redis).toBeDefined()
      expect(redis.incr).toBeDefined()
      expect(redis.ping).toBeDefined()
      expect(redis.get).toBeDefined()
      expect(redis.set).toBeDefined()
      expect(redis.del).toBeDefined()
    })

    test('should ping', async () => {
      const redis = createMockRedis()
      const result = await redis.ping()

      expect(result).toBe('PONG')
    })

    test('should quit', async () => {
      const redis = createMockRedis()
      const result = await redis.quit()

      expect(result).toBe('OK')
    })

    test('should set and get values', async () => {
      const redis = createMockRedis()

      await redis.set('key1', 'value1')
      const result = await redis.get('key1')

      expect(result).toBe('value1')
    })

    test('should return null for non-existent keys', async () => {
      const redis = createMockRedis()
      const result = await redis.get('non-existent')

      expect(result).toBeNull()
    })

    test('should delete keys', async () => {
      const redis = createMockRedis()

      await redis.set('key2', 'value2')
      const delResult = await redis.del('key2')
      const getResult = await redis.get('key2')

      expect(delResult).toBe(1)
      expect(getResult).toBeNull()
    })

    test('should increment values', async () => {
      const redis = createMockRedis()

      const result1 = await redis.incr('counter')
      const result2 = await redis.incr('counter')
      const result3 = await redis.incr('counter')

      expect(result1).toBe(1)
      expect(result2).toBe(2)
      expect(result3).toBe(3)
    })

    test('should set expiry', async () => {
      const redis = createMockRedis()
      const result = await redis.pexpire('key', 1000)

      expect(result).toBe(1)
    })

    test('should get ttl', async () => {
      const redis = createMockRedis()
      const result = await redis.pttl('key')

      expect(result).toBe(900000)
    })

    test('should maintain separate state for each instance', async () => {
      const redis1 = createMockRedis()
      const redis2 = createMockRedis()

      await redis1.set('key', 'value1')
      await redis2.set('key', 'value2')

      const result1 = await redis1.get('key')
      const result2 = await redis2.get('key')

      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
    })
  })
})
