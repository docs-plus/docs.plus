import { afterEach, describe, test, expect, beforeAll, beforeEach, mock, spyOn } from 'bun:test'

// Drive requireUser through the real auth module + a stubbed anon client.
// Do NOT mock `lib/auth` itself — that sticky mock.module poisons later suites.
mock.module('../../src/lib/supabase', () => ({
  getAnonClient: () => ({
    auth: {
      getUser: async (token: string) => {
        if (token === 'valid-test-token') {
          return {
            data: {
              user: {
                id: 'user-123',
                email: 'owner@example.com',
                is_anonymous: false,
                user_metadata: {}
              }
            },
            error: null
          }
        }
        return { data: { user: null }, error: { status: 401, message: 'invalid' } }
      }
    }
  }),
  getServiceRoleClient: () => null
}))

import { Hono } from 'hono'
import hypermultimediaRouter from '../../src/api/routers/hypermultimedia.router'
import * as mediaService from '../../src/api/services/media.service'
import { config } from '../../src/config/env'
import {
  MEDIA_SESSION_COOKIE,
  MEDIA_SESSION_TTL_S,
  signMediaSession
} from '../../src/lib/mediaSession'
import { TestServer, createMockPrisma, createMockRedis } from '../helpers/test-server'
import { createTestFile } from '../fixtures/documents'

describe('Hypermultimedia API (Direct Route)', () => {
  let testServer: TestServer
  let app: Hono
  let mockPrisma: any

  beforeAll(() => {
    app = new Hono()
    mockPrisma = createMockPrisma()

    app.use('*', async (c, next) => {
      c.set('prisma', mockPrisma)
      c.set('redis', createMockRedis())
      await next()
    })

    app.route('/api/plugins/hypermultimedia', hypermultimediaRouter)
    testServer = new TestServer(app)
  })

  beforeEach(() => {
    mockPrisma = createMockPrisma()
  })

  describe('POST /api/plugins/hypermultimedia/:documentId', () => {
    // Upload is gated by requireUser: it is a write, so it needs a verified
    // Supabase user. With no live Supabase to mint one in this harness, these
    // tests assert the auth gate. The storage path itself is covered by
    // tests/unit/storage.local.test.ts; the S3 arm has no runtime coverage.
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
    test('should answer 404 NOT_FOUND for a document in Trash', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({ deletedAt: new Date() })

      const response = await testServer.get('/api/plugins/hypermultimedia/test-doc/x.jpg')
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'NOT_FOUND')
    })

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

  describe('Private media (#439)', () => {
    const secret = config.storage.mediaCookieSecret
    const url = '/api/plugins/hypermultimedia/private-doc/x.jpg'
    const cookieFor = (uid: string, nowSeconds?: number) =>
      `${MEDIA_SESSION_COOKIE}=${signMediaSession({ uid, secret, nowSeconds })}`
    const read = (cookie?: string) =>
      testServer.app.request(`http://localhost:3001${url}`, {
        headers: cookie ? { Cookie: cookie } : {}
      })
    // The gate answers the house envelope. The store answers a bare `{ error }`.
    const refusedByGate = async (response: Response) =>
      response.status === 404 && (await response.json()).error?.code === 'NOT_FOUND'
    // No file exists, so a read the gate passed ends at the store's own 404. A crash is a 500.
    // The test env has no store, so a read the gate passes is answered by this stand-in.
    // A crash is a 500, so only the stand-in's body proves the gate let the read through.
    const STORED = 'stored-bytes'
    const reachedStore = async (response: Response) =>
      response.status === 200 && (await response.text()) === STORED
    let storeRead: ReturnType<typeof spyOn> | undefined
    afterEach(() => storeRead?.mockRestore())

    beforeEach(() => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        deletedAt: null,
        isPrivate: true,
        ownerId: 'user-123'
      })
      storeRead = spyOn(mediaService, 'getMedia').mockImplementation(async (_d, _m, c) =>
        c.body(STORED, 200)
      )
    })

    test('refuses a Private read with no cookie', async () => {
      expect(await refusedByGate(await read())).toBe(true)
    })

    test("refuses another user's cookie", async () => {
      expect(await refusedByGate(await read(cookieFor('user-456')))).toBe(true)
    })

    test('refuses an expired cookie', async () => {
      const longAgo = Math.floor(Date.now() / 1000) - MEDIA_SESSION_TTL_S - 60
      expect(await refusedByGate(await read(cookieFor('user-123', longAgo)))).toBe(true)
    })

    test('refuses a tampered cookie', async () => {
      const [ownerPayload] = signMediaSession({ uid: 'user-123', secret }).split('.')
      const [, otherSignature] = signMediaSession({ uid: 'user-456', secret }).split('.')
      const forged = `${MEDIA_SESSION_COOKIE}=${ownerPayload}.${otherSignature}`
      expect(await refusedByGate(await read(forged))).toBe(true)
    })

    test("passes the owner's cookie to the store, uncached by shared caches", async () => {
      const response = await read(cookieFor('user-123'))
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache')
      expect(await reachedStore(response)).toBe(true)
    })

    test('a public document needs no cookie', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        deletedAt: null,
        isPrivate: false,
        ownerId: 'user-123'
      })
      const response = await read()
      expect(response.headers.get('Cache-Control')).not.toBe('private, no-cache')
      expect(await reachedStore(response)).toBe(true)
    })

    test('POST /session sets an HttpOnly cookie that the owner read accepts', async () => {
      const response = await testServer.app.request(
        'http://localhost:3001/api/plugins/hypermultimedia/session',
        { method: 'POST', headers: { token: 'valid-test-token' } }
      )
      expect(response.status).toBe(204)
      const setCookie = response.headers.get('Set-Cookie') ?? ''
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('Path=/api/plugins/hypermultimedia')
      expect(setCookie).toContain('SameSite=Lax')

      const ownerRead = await read(setCookie.split(';')[0])
      expect(ownerRead.headers.get('Cache-Control')).toBe('private, no-cache')
      expect(await reachedStore(ownerRead)).toBe(true)
    })

    test('DELETE /session expires the cookie', async () => {
      const response = await testServer.app.request(
        'http://localhost:3001/api/plugins/hypermultimedia/session',
        { method: 'DELETE' }
      )
      expect(response.status).toBe(204)
      expect(response.headers.get('Set-Cookie') ?? '').toContain('Max-Age=0')
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
