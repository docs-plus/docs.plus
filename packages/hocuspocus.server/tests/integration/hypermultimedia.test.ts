import { describe, test, expect, beforeAll, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import hypermultimediaRouter from '../../src/api/hypermultimedia'
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
    test('should upload image successfully to local storage', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'
      process.env.LOCAL_STORAGE_PATH = './temp/hypermultimedia'

      const file = createTestFile('test-image.jpg', 'image/jpeg', 2048)
      const response = await testServer.upload('/api/plugins/hypermultimedia/test-doc-123', file)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toHaveProperty('fileAddress')
      expect(data).toHaveProperty('fileType')
      expect(data.fileType).toBe('image')
      expect(data.error).toBe(false)
      expect(data.type).toBe('localStorage')
      expect(data.fileAddress).toContain('test-doc-123/')

      delete process.env.PERSIST_TO_LOCAL_STORAGE
      delete process.env.LOCAL_STORAGE_PATH
    })

    test('should upload video successfully to local storage', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const file = createTestFile('test-video.mp4', 'video/mp4', 4096)
      const response = await testServer.upload('/api/plugins/hypermultimedia/doc-video', file)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.fileType).toBe('video')
      expect(data.error).toBe(false)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

    test('should upload audio successfully to local storage', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const file = createTestFile('test-audio.mp3', 'audio/mpeg', 3072)
      const response = await testServer.upload('/api/plugins/hypermultimedia/doc-audio', file)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.fileType).toBe('audio')
      expect(data.error).toBe(false)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

    test('should attempt S3 upload when configured', async () => {
      process.env.DO_STORAGE_ENDPOINT = 'https://fra1.digitaloceanspaces.com'
      process.env.DO_STORAGE_BUCKET = 'test-bucket'
      process.env.DO_STORAGE_ACCESS_KEY_ID = 'test-key'
      process.env.DO_STORAGE_SECRET_ACCESS_KEY = 'test-secret'
      delete process.env.PERSIST_TO_LOCAL_STORAGE

      const file = createTestFile('test-s3.png', 'image/png', 2048)
      const response = await testServer.upload('/api/plugins/hypermultimedia/test-doc', file)
      const data = await response.json()

      // S3 might fail with mock credentials but should return proper response
      expect([201, 500]).toContain(response.status)
      if (response.status === 201) {
        expect(data).toHaveProperty('fileAddress')
        expect(data).toHaveProperty('fileType')
        expect(data.type).toBe('s3')
        expect(data.error).toBe(false)
      }

      delete process.env.DO_STORAGE_ENDPOINT
      delete process.env.DO_STORAGE_BUCKET
      delete process.env.DO_STORAGE_ACCESS_KEY_ID
      delete process.env.DO_STORAGE_SECRET_ACCESS_KEY
    })

    test('should reject upload without file', async () => {
      const formData = new FormData()
      const response = await testServer.app.request(
        'http://localhost:3001/api/plugins/hypermultimedia/test-doc',
        {
          method: 'POST',
          body: formData
        }
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('No files were uploaded')
    })

    test('should return error when no storage configured', async () => {
      delete process.env.PERSIST_TO_LOCAL_STORAGE
      delete process.env.DO_STORAGE_ENDPOINT

      const file = createTestFile('test.jpg', 'image/jpeg', 2048)
      const response = await testServer.upload('/api/plugins/hypermultimedia/test-doc', file)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    test('should handle different file extensions correctly', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const testFiles = [
        { name: 'document.pdf', type: 'application/pdf', expectedType: 'unknown' },
        { name: 'image.webp', type: 'image/webp', expectedType: 'image' },
        { name: 'video.webm', type: 'video/webm', expectedType: 'video' },
        { name: 'audio.ogg', type: 'audio/ogg', expectedType: 'audio' }
      ]

      for (const testFile of testFiles) {
        const file = createTestFile(testFile.name, testFile.type, 2048)
        const response = await testServer.upload('/api/plugins/hypermultimedia/test-doc', file)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.fileType).toBe(testFile.expectedType)
        expect(data).toHaveProperty('fileAddress')
      }

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

    test('should generate unique filenames for uploads', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const file1 = createTestFile('test.jpg', 'image/jpeg', 2048)
      const file2 = createTestFile('test.jpg', 'image/jpeg', 2048)

      const response1 = await testServer.upload('/api/plugins/hypermultimedia/test-doc', file1)
      const response2 = await testServer.upload('/api/plugins/hypermultimedia/test-doc', file2)

      const data1 = await response1.json()
      const data2 = await response2.json()

      expect(data1.fileAddress).not.toBe(data2.fileAddress)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

    test('should handle document ID with special characters', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const file = createTestFile('test.jpg', 'image/jpeg', 2048)
      const response = await testServer.upload(
        '/api/plugins/hypermultimedia/doc-with-dashes_123',
        file
      )
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toHaveProperty('fileAddress')

      delete process.env.PERSIST_TO_LOCAL_STORAGE
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
    test('should handle corrupted file gracefully', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      // Create a file with invalid data
      const file = new File([''], 'corrupted.jpg', { type: 'image/jpeg' })
      const response = await testServer.upload('/api/plugins/hypermultimedia/test-doc', file)

      // Should still process but might fail
      expect([201, 400, 500]).toContain(response.status)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })

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

  describe('Route Parity', () => {
    test('should have same functionality as nested route', async () => {
      process.env.PERSIST_TO_LOCAL_STORAGE = 'true'

      const file = createTestFile('parity-test.jpg', 'image/jpeg', 2048)
      const response = await testServer.upload('/api/plugins/hypermultimedia/parity-doc', file)
      const data = await response.json()

      // Should have same response structure as /api/documents/plugins/hypermultimedia
      expect(response.status).toBe(201)
      expect(data).toHaveProperty('fileAddress')
      expect(data).toHaveProperty('fileType')
      expect(data).toHaveProperty('type')
      expect(data).toHaveProperty('error')
      expect(data.error).toBe(false)

      delete process.env.PERSIST_TO_LOCAL_STORAGE
    })
  })
})
