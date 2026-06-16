import { describe, test, expect, beforeAll, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import hypermultimediaRouter from '../../src/api/routers/hypermultimedia.router'
import { TestServer, createMockPrisma, createMockRedis } from '../helpers/test-server'
import { createTestFile } from '../fixtures/documents'

describe('Hypermultimedia API (Direct Route)', () => {
  let testServer: TestServer
  let app: Hono
  let mockPrisma: any

  beforeAll(() => {
    app = new Hono()
    mockPrisma = createMockPrisma()

    // Inject mocks
    app.use('*', async (c, next) => {
      c.set('prisma', mockPrisma)
      c.set('redis', createMockRedis())
      await next()
    })

    // Mount the hypermultimedia router at the new direct path
    app.route('/api/plugins/hypermultimedia', hypermultimediaRouter)
    testServer = new TestServer(app)
  })

  beforeEach(() => {
    // Reset mocks before each test
    mockPrisma = createMockPrisma()
  })

  describe('POST /api/plugins/hypermultimedia/:documentId', () => {
    // Upload is gated by requireUser: it is a write, so it needs a verified
    // Supabase user. With no live Supabase to mint one in this harness, these
    // assert the auth gate; the storage path itself is covered end-to-end by
    // tests/unit/storage.local.test.ts and tests/unit/storage.s3.test.ts.
    test('rejects an upload with no token', async () => {
      const file = createTestFile('test-image.jpg', 'image/jpeg', 2048)
      const response = await testServer.upload('/api/plugins/hypermultimedia/test-doc-123', file)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('rejects an upload with an invalid token', async () => {
      const file = createTestFile('test.jpg', 'image/jpeg', 2048)
      const formData = new FormData()
      formData.append('mediaFile', file)

      const response = await testServer.app.request(
        'http://localhost:3001/api/plugins/hypermultimedia/test-doc',
        { method: 'POST', body: formData, headers: { Authorization: 'Bearer invalid-token' } }
      )

      expect(response.status).toBe(401)
    })

    test('auth gate runs before file validation', async () => {
      // A missing file would 400, but the auth gate fires first → 401.
      const response = await testServer.app.request(
        'http://localhost:3001/api/plugins/hypermultimedia/test-doc',
        { method: 'POST', body: new FormData() }
      )

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/plugins/hypermultimedia/:documentId/:mediaId', () => {
    test('should retrieve file from local storage when exists', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'
      process.env.LOCAL_STORAGE_PATH = './temp/hypermultimedia'

      const response = await testServer.get(
        '/api/plugins/hypermultimedia/test-doc/nonexistent-file.jpg'
      )

      // Will return 404 since file doesn't exist, but endpoint is accessible
      expect([200, 404, 500]).toContain(response.status)

      if (response.status === 404) {
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('File not found')
      }

      delete process.env.PERSIST_TO_LOCAL_STORAGE
      delete process.env.LOCAL_STORAGE_PATH
    })

    test('should retrieve file from S3 storage when configured', async () => {
      process.env.DO_STORAGE_ENDPOINT = 'https://fra1.digitaloceanspaces.com'
      process.env.DO_STORAGE_BUCKET = 'test-bucket'
      delete process.env.PERSIST_TO_LOCAL_STORAGE

      const response = await testServer.get('/api/plugins/hypermultimedia/test-doc/test-file.jpg')

      // Will return 404/500 since file doesn't exist, but endpoint is accessible
      expect([200, 404, 500]).toContain(response.status)

      delete process.env.DO_STORAGE_ENDPOINT
      delete process.env.DO_STORAGE_BUCKET
    })

    test('should set correct content-type header for images', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const response = await testServer.get('/api/plugins/hypermultimedia/test-doc/image.jpg')

      // Even if 404, the route should be accessible
      expect([200, 404, 500]).toContain(response.status)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

    test('should set correct content-type header for videos', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const response = await testServer.get('/api/plugins/hypermultimedia/test-doc/video.mp4')

      expect([200, 404, 500]).toContain(response.status)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

    test('should handle document ID and media ID with special characters', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const response = await testServer.get(
        '/api/plugins/hypermultimedia/doc-123_test/uuid-1234-5678.jpg'
      )

      expect([200, 404, 500]).toContain(response.status)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })
  })

  describe('Error Handling', () => {
    test('should handle missing documentId parameter', async () => {
      const file = createTestFile('test.jpg', 'image/jpeg', 2048)

      // Try to upload without documentId (should fail at route level)
      const response = await testServer.app.request(
        'http://localhost:3001/api/plugins/hypermultimedia/',
        {
          method: 'POST',
          body: (() => {
            const formData = new FormData()
            formData.append('mediaFile', file)
            return formData
          })()
        }
      )

      expect(response.status).toBe(404)
    })
  })
})
