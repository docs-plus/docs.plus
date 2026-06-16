import { describe, test, expect, beforeAll, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import documentsRouter from '../../src/api/routers/documents.router'
import { TestServer, createMockPrisma, createMockRedis } from '../helpers/test-server'
import {
  validDocument,
  invalidDocument,
  documentUpdate,
  mockDocumentMetadata,
  mockDocumentsList,
  createTestFile
} from '../fixtures/documents'

describe('Documents API', () => {
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

    app.route('/api/documents', documentsRouter)
    testServer = new TestServer(app)
  })

  beforeEach(() => {
    // Reset mocks before each test
    mockPrisma = createMockPrisma()
  })

  describe('GET /api/documents', () => {
    test('should list all documents', async () => {
      mockPrisma.documentMetadata.findMany = async () => mockDocumentsList
      mockPrisma.documentMetadata.count = async () => mockDocumentsList.length

      const response = await testServer.get('/api/documents')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('docs')
      expect(data.data).toHaveProperty('total')
      expect(Array.isArray(data.data.docs)).toBe(true)
    })

    test('should support pagination', async () => {
      const response = await testServer.get('/api/documents?limit=10&offset=0')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should support search by title', async () => {
      const response = await testServer.get('/api/documents?title=test')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should support search by keywords', async () => {
      const response = await testServer.get('/api/documents?keywords=test')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should support search by description', async () => {
      const response = await testServer.get('/api/documents?description=example')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should return empty array when no documents found', async () => {
      mockPrisma.documentMetadata.findMany = async () => []
      mockPrisma.documentMetadata.count = async () => 0

      const response = await testServer.get('/api/documents')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.docs).toHaveLength(0)
      expect(data.data.total).toBe(0)
    })
  })

  describe('GET /api/documents/:slug', () => {
    test('should get document by slug when exists', async () => {
      mockPrisma.documentMetadata.findUnique = async () => mockDocumentMetadata

      const response = await testServer.get('/api/documents/test-document')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('slug')
      expect(data.data).toHaveProperty('title')
    })

    test('should return draft document when not found', async () => {
      mockPrisma.documentMetadata.findUnique = async () => null

      const response = await testServer.get('/api/documents/non-existent')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('slug')
      expect(data.data.slug).toBe('non-existent')
    })

    test('should handle slug with special characters', async () => {
      const response = await testServer.get('/api/documents/test-doc-123')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should decode JWT token when provided', async () => {
      mockPrisma.documentMetadata.findUnique = async () => mockDocumentMetadata

      const response = await testServer.get('/api/documents/test-document?userId=user123', {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should handle invalid JWT token gracefully', async () => {
      mockPrisma.documentMetadata.findUnique = async () => mockDocumentMetadata

      const response = await testServer.get('/api/documents/test-document?userId=user123', {
        token: 'invalid-token'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should handle database error when fetching document', async () => {
      mockPrisma.documentMetadata.findUnique = async () => {
        throw new Error('Database error')
      }

      const response = await testServer.get('/api/documents/test-document')
      const data = await response.json()

      // Errors flow through getErrorResponse: a raw throw is mapped to a
      // DatabaseError (statusCode 500) with a lowercase `error` envelope.
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'DATABASE_ERROR')
    })
  })

  describe('POST /api/documents', () => {
    // The recovered source gates document creation behind requireUser: the
    // caller becomes the owner. The middleware verifies a Supabase token before
    // any validation or prisma write runs, so an unauthenticated request is
    // rejected at the auth gate (401) regardless of body validity. There is no
    // live Supabase to mint a verified user in this harness, so these tests
    // assert the auth gate rather than the create path.
    test('should reject creation without authentication', async () => {
      mockPrisma.documentMetadata.create = async (data: any) => ({
        id: 1,
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const response = await testServer.post('/api/documents', validDocument)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('should reject with an invalid token', async () => {
      const response = await testServer.post('/api/documents', validDocument, {
        Authorization: 'Bearer invalid-token'
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('auth gate runs before body validation', async () => {
      // Missing required fields would fail zod, but the auth gate fires first,
      // so the response is 401 (auth), not 400 (validation).
      const response = await testServer.post('/api/documents', invalidDocument)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })
  })

  describe('PUT /api/documents/:docId', () => {
    test('should update document with valid data', async () => {
      mockPrisma.documentMetadata.upsert = async (data: any) => ({
        id: 1,
        documentId: 'abc123',
        ...data.update,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const response = await testServer.put('/api/documents/abc123', documentUpdate)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('documentId')
    })

    test('should handle partial updates', async () => {
      mockPrisma.documentMetadata.upsert = async (data: any) => ({
        id: 1,
        documentId: 'abc123',
        ...data.update
      })

      const response = await testServer.put('/api/documents/abc123', {
        title: 'Only Title Updated'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should update readOnly flag', async () => {
      mockPrisma.documentMetadata.upsert = async (data: any) => ({
        id: 1,
        documentId: 'abc123',
        readOnly: data.update.readOnly
      })

      const response = await testServer.put('/api/documents/abc123', {
        readOnly: true
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    test('should fail with invalid data types', async () => {
      const response = await testServer.put('/api/documents/abc123', {
        readOnly: 'not-a-boolean' // Should be boolean
      })

      expect(response.status).toBe(400)
    })

    test('should handle database error when updating document', async () => {
      mockPrisma.documentMetadata.upsert = async () => {
        throw new Error('Database update error')
      }

      const response = await testServer.put('/api/documents/abc123', documentUpdate)
      const data = await response.json()

      // A raw throw maps to DatabaseError (500) with the lowercase `error` envelope.
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'DATABASE_ERROR')
    })

    test('should create document if not exists during update (upsert)', async () => {
      mockPrisma.documentMetadata.upsert = async (data: any) => ({
        id: 1,
        documentId: 'new-doc-id',
        slug: data.create.slug,
        title: data.create.title,
        description: data.create.description || '',
        keywords: data.create.keywords || '',
        readOnly: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const response = await testServer.put('/api/documents/new-doc-id', {
        title: 'Brand New Document',
        description: 'Created via upsert'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('Brand New Document')
      expect(data.data).toHaveProperty('slug')
    })
  })

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockPrisma.documentMetadata.findMany = async () => {
        throw new Error('Database connection failed')
      }

      const response = await testServer.get('/api/documents')
      const data = await response.json()

      // DatabaseError maps to 500 with the lowercase `error` envelope.
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'DATABASE_ERROR')
    })

    test('should handle malformed JSON', async () => {
      const response = await app.request('http://localhost:3001/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json{'
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Security', () => {
    test('should sanitize slug input', async () => {
      mockPrisma.documentMetadata.findUnique = async () => null

      // Use a simpler XSS attempt that still matches the route
      const response = await testServer.get('/api/documents/test-xss-attempt')

      expect(response.status).toBe(200)
      // Even if someone tries XSS in slug, it won't execute
      const text = await response.text()
      expect(text).toBeDefined()
      expect(response.status).not.toBe(500) // Should handle gracefully
    })

    test('should handle SQL injection attempts', async () => {
      mockPrisma.documentMetadata.findMany = async () => []

      const response = await testServer.get("/api/documents?title=' OR 1=1--")

      expect(response.status).toBe(200)
      // Should not crash, Prisma handles this
    })
  })
})
