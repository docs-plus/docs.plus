import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test'

// Drive requireUser/optionalUser through the real auth module + a stubbed anon
// client. Do NOT mock `lib/auth` itself — that sticky mock.module poisons later
// suites (e.g. auth.test.ts) in the same bun test process.
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

// Capture footprint-purge invocations so the permanent-delete tests can assert
// the purge path runs (and forwards the row's slug) without a live Supabase/RPC.
const purgeCalls: Array<{ documentId: string; slug: string }> = []
mock.module('../../src/api/services/documentPurge.service', () => ({
  purgeDocumentFootprint: async (_prisma: any, _supabase: any, opts: any) => {
    purgeCalls.push(opts)
    return { purged: 1 }
  }
}))

import { Hono } from 'hono'
import { searchDocuments } from '../../src/api/services/documents.service'
import documentsRouter from '../../src/api/routers/documents.router'
import { config } from '../../src/config/env'
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

    app.use('*', async (c, next) => {
      c.set('prisma', mockPrisma)
      c.set('redis', createMockRedis())
      await next()
    })

    app.route('/api/documents', documentsRouter)
    testServer = new TestServer(app)
  })

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    purgeCalls.length = 0
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

    test('should reject ownerId filter without auth', async () => {
      const response = await testServer.get(
        '/api/documents?ownerId=123e4567-e89b-12d3-a456-426614174000'
      )
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('should reject ownerId that does not match the token subject', async () => {
      // valid-test-token → sub 'user-123'; a UUID ownerId can never equal it.
      const response = await testServer.get(
        '/api/documents?ownerId=123e4567-e89b-12d3-a456-426614174000',
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
    })

    test('maps each sort key to the allowlisted Prisma orderBy', async () => {
      const cases: Array<[string, Record<string, string>]> = [
        ['updatedAt_desc', { updatedAt: 'desc' }],
        ['createdAt_desc', { createdAt: 'desc' }],
        ['title_asc', { title: 'asc' }],
        ['title_desc', { title: 'desc' }]
      ]

      for (const [sort, expected] of cases) {
        let captured: any
        mockPrisma.documentMetadata.findMany = async (args: any) => {
          captured = args
          return []
        }
        mockPrisma.documentMetadata.count = async () => 0

        const response = await testServer.get(`/api/documents?sort=${sort}`)
        expect(response.status).toBe(200)
        expect(captured.orderBy).toEqual(expected)
      }
    })

    test('lastOpenedAt_desc sorts only the owner live list; other calls fall back', async () => {
      let captured: { orderBy?: unknown } | undefined
      mockPrisma.documentMetadata.findMany = async (args: { orderBy?: unknown }) => {
        captured = args
        return []
      }
      mockPrisma.documentMetadata.count = async () => 0

      const response = await testServer.get('/api/documents?sort=lastOpenedAt_desc')
      expect(response.status).toBe(200)
      expect(captured?.orderBy).toEqual({ updatedAt: 'desc' })

      const base = { sort: 'lastOpenedAt_desc' as const, limit: 10, offset: 0 }
      await searchDocuments(mockPrisma, { ...base, requesterId: 'user-456' })
      expect(captured?.orderBy).toEqual({ updatedAt: 'desc' })

      await searchDocuments(mockPrisma, { ...base, requesterId: 'user-456', ownerId: 'user-123' })
      expect(captured?.orderBy).toEqual({ updatedAt: 'desc' })
    })

    test('defaults to updatedAt_desc when sort is omitted', async () => {
      let captured: any
      mockPrisma.documentMetadata.findMany = async (args: any) => {
        captured = args
        return []
      }

      const response = await testServer.get('/api/documents')
      expect(response.status).toBe(200)
      expect(captured.orderBy).toEqual({ updatedAt: 'desc' })
    })

    test('anon fleet list without ownerId clamps out private rows', async () => {
      let captured: any
      mockPrisma.documentMetadata.findMany = async (args: any) => {
        captured = args
        return []
      }

      const response = await testServer.get('/api/documents')
      expect(response.status).toBe(200)
      // Both the page query and its count must exclude private rows so `total`
      // neither leaks private counts nor over-runs Load more.
      expect(captured.where).toMatchObject({ isPrivate: false })
      // Soft-deleted rows are invisible in the list branch until the reaper purges them.
      expect(captured.where.deletedAt).toBeNull()
    })

    test('anon title search clamps out private rows', async () => {
      let captured: any
      mockPrisma.documentMetadata.findMany = async (args: any) => {
        captured = args
        return []
      }

      const response = await testServer.get('/api/documents?title=secret-handbook')
      expect(response.status).toBe(200)
      expect(captured.where.isPrivate).toBe(false)
      // Soft-deleted rows are also excluded from the search branch.
      expect(captured.where.deletedAt).toBeNull()
    })

    test('trash list requires authentication', async () => {
      const response = await testServer.get('/api/documents?deleted=true')
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('trash list returns only the caller-owned soft-deleted docs, newest tombstone first', async () => {
      let captured: any
      mockPrisma.documentMetadata.findMany = async (args: any) => {
        captured = args
        return []
      }
      mockPrisma.documentMetadata.count = async () => 0

      const response = await testServer.get('/api/documents?deleted=true', {
        token: 'valid-test-token'
      })
      expect(response.status).toBe(200)
      // Owner-scoped to the token subject (never a client-supplied ownerId) and
      // inverted to deletedAt-NOT-null, ordered by newest tombstone first.
      expect(captured.where.ownerId).toBe('user-123')
      expect(captured.where.deletedAt).toEqual({ not: null })
      expect(captured.orderBy).toEqual({ deletedAt: 'desc' })
    })
  })

  describe('GET /api/documents?scope', () => {
    // A small in-memory Prisma over the where shapes the scoped list writes. Comparisons
    // follow SQL: `{ not: x }` and `{ in }` are never true on NULL, which is the trap.
    type Row = Record<string, any> & { favorites: { userId: string }[] }

    const matches = (row: Record<string, any>, where: any): boolean =>
      Object.entries(where ?? {}).every(([key, cond]: [string, any]) => {
        if (key === 'AND') return cond.every((w: any) => matches(row, w))
        if (key === 'OR') return cond.some((w: any) => matches(row, w))
        if (key === 'favorites' && cond.some)
          return row.favorites.some((f: any) => matches(f, cond.some))
        if (key === 'favorites' && cond.none)
          return !row.favorites.some((f: any) => matches(f, cond.none))
        const value = row[key]
        if (cond === null || typeof cond !== 'object') return value === cond
        if ('in' in cond) return value != null && cond.in.includes(value)
        if ('not' in cond)
          return cond.not === null ? value != null : value != null && value !== cond.not
        if ('contains' in cond) return typeof value === 'string' && value.includes(cond.contains)
        if ('search' in cond) return typeof value === 'string' && value.includes(cond.search)
        throw new Error(`Unsupported filter on ${key}`)
      })

    const compare = (orderBy: any) => (a: Row, b: Row) => {
      for (const term of [orderBy].flat()) {
        const [field, spec] = Object.entries(term)[0] as [string, any]
        if (typeof spec === 'object' && '_count' in spec) throw new Error('Unexpected count order')
        const dir = typeof spec === 'string' ? spec : spec.sort
        const [av, bv] = [a[field], b[field]]
        if (av === bv) continue
        if (av == null) return 1
        if (bv == null) return -1
        return (av < bv ? -1 : 1) * (dir === 'desc' ? -1 : 1)
      }
      return 0
    }

    const project = (row: Row, select: any) =>
      Object.fromEntries(
        Object.entries(select).flatMap(([key, on]: [string, any]) =>
          key === 'favorites'
            ? [[key, row.favorites.filter((f) => matches(f, on.where))]]
            : on
              ? [[key, row[key]]]
              : []
        )
      )

    const fakePrisma = (rows: Row[]) =>
      ({
        ...createMockPrisma(),
        documentMetadata: {
          count: async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
          findMany: async ({ where, orderBy, select, skip = 0, take }: any) =>
            rows
              .filter((r) => matches(r, where))
              .sort(compare(orderBy))
              .slice(skip, skip + take)
              .map((r) => project(r, select))
        }
      }) as any

    const day = (n: number) => new Date(Date.UTC(2026, 8, n))
    const row = (slug: string, fields: Partial<Row> = {}): Row => ({
      id: 0,
      slug,
      title: slug,
      description: '',
      documentId: `id-${slug}`,
      keywords: '',
      ownerId: null,
      readOnly: false,
      isPrivate: false,
      createdAt: day(1),
      updatedAt: day(1),
      deletedAt: null,
      lastOpenedAt: null,
      preview: { heading: null, lines: [] },
      favorites: [],
      ...fields
    })

    const ME = 'user-123'
    const OTHER = 'user-456'
    const rows: Row[] = [
      row('own-opened', {
        ownerId: ME,
        title: 'Garden notes',
        updatedAt: day(2),
        lastOpenedAt: day(20)
      }),
      row('own-private', { ownerId: ME, isPrivate: true, updatedAt: day(3) }),
      row('own-fav', { ownerId: ME, updatedAt: day(4), favorites: [{ userId: ME }] }),
      row('own-deleted', { ownerId: ME, deletedAt: day(5) }),
      // The owner's star and open stamp: neither may pin, sort or show for the caller.
      row('other-public', {
        ownerId: OTHER,
        title: 'Budget',
        updatedAt: day(9),
        lastOpenedAt: day(29),
        favorites: [{ userId: OTHER }]
      }),
      row('other-private', { ownerId: OTHER, title: 'Garden secret', isPrivate: true }),
      row('other-deleted', { ownerId: OTHER, deletedAt: day(6) }),
      row('ownerless', { title: 'Garden plan', updatedAt: day(8) }),
      row('ownerless-private', { isPrivate: true }),
      row('stranger', { ownerId: OTHER })
    ]
    const memberOf = [
      'own-opened',
      'other-public',
      'other-private',
      'other-deleted',
      'ownerless',
      'ownerless-private'
    ].map((slug) => `id-${slug}`)

    const list = (scope: 'all' | 'joined', extra: Record<string, unknown> = {}) =>
      searchDocuments(fakePrisma(rows), {
        requesterId: ME,
        membership: { scope, documentIds: memberOf },
        limit: 100,
        offset: 0,
        ...extra
      })
    const slugs = (result: { docs: { slug: string }[] }) => result.docs.map((d) => d.slug)

    test('all lists owned rows plus public live memberships, never private or deleted ones', async () => {
      for (const sort of ['updatedAt_desc', 'lastOpenedAt_desc', 'title_asc'] as const) {
        const result = await list('all', { sort })
        expect(slugs(result).sort()).toEqual(
          ['other-public', 'own-fav', 'own-opened', 'own-private', 'ownerless'].sort()
        )
        expect(result.total).toBe(5)
      }
    })

    test('joined keeps ownerless rows and drops owned, private and deleted ones', async () => {
      const result = await list('joined')
      expect(slugs(result)).toEqual(['other-public', 'ownerless'])
      expect(result.total).toBe(2)
    })

    test('search composes with the scope instead of replacing it', async () => {
      expect(slugs(await list('joined', { title: 'Garden' }))).toEqual(['ownerless'])
      const all = await list('all', { title: 'Garden' })
      expect(slugs(all).sort()).toEqual(['own-opened', 'ownerless'])
      expect(all.total).toBe(2)
    })

    test("pins only the caller's favorites and strips owner fields from non-owned rows", async () => {
      const result = await list('all')
      expect(slugs(result)).toEqual([
        'own-fav',
        'other-public',
        'ownerless',
        'own-private',
        'own-opened'
      ])
      const bySlug = Object.fromEntries(result.docs.map((d: any) => [d.slug, d]))
      expect(bySlug['own-fav']).toMatchObject({ isOwner: true, isFavorite: true })
      expect(bySlug['own-opened'].lastOpenedAt).toEqual(day(20))
      for (const slug of ['other-public', 'ownerless']) {
        expect(bySlug[slug].isOwner).toBe(false)
        expect(bySlug[slug]).not.toHaveProperty('isFavorite')
        expect(bySlug[slug]).not.toHaveProperty('lastOpenedAt')
      }
    })

    test('Last opened sorts a non-owned row as never opened', async () => {
      const result = await list('all', { sort: 'lastOpenedAt_desc' })
      expect(slugs(result)).toEqual([
        'own-fav',
        'own-opened',
        'other-public',
        'ownerless',
        'own-private'
      ])
    })

    test('offset pages walk the tiers without gaps or repeats', async () => {
      const whole = slugs(await list('all', { sort: 'lastOpenedAt_desc' }))
      const paged: string[] = []
      for (let offset = 0; offset < whole.length; offset += 2) {
        paged.push(...slugs(await list('all', { sort: 'lastOpenedAt_desc', limit: 2, offset })))
      }
      expect(paged).toEqual(whole)
    })

    test('scope requires a token', async () => {
      const response = await testServer.get('/api/documents?scope=all')
      expect(response.status).toBe(401)
    })

    test('scope cannot be combined with Trash', async () => {
      const response = await testServer.get('/api/documents?scope=joined&deleted=true', {
        token: 'valid-test-token'
      })
      expect(response.status).toBe(400)
    })

    test('fails closed with 503 when membership cannot be read', async () => {
      let listed = false
      mockPrisma.documentMetadata.findMany = async () => {
        listed = true
        return []
      }
      // The suite's service-role client is null, so the membership read fails.
      const response = await testServer.get('/api/documents?scope=all', {
        token: 'valid-test-token'
      })
      const data = await response.json()
      expect(response.status).toBe(503)
      expect(data.error).toHaveProperty('code', 'SERVICE_UNAVAILABLE')
      expect(listed).toBe(false)
    })

    test('scope=owned is the owner live list of the token subject', async () => {
      const { count, findMany } = fakePrisma(rows).documentMetadata
      Object.assign(mockPrisma.documentMetadata, { count, findMany })
      const response = await testServer.get('/api/documents?scope=owned', {
        token: 'valid-test-token'
      })
      expect(response.status).toBe(200)
      const { data } = await response.json()
      expect(slugs(data)).toEqual(['own-fav', 'own-private', 'own-opened'])
      expect(data.total).toBe(3)
    })

    test("the owner live list pins only the caller's own favorites", async () => {
      // ME's star sits on the oldest row and OTHER's on the newest, so a plain sort fails.
      // The two dates disagree on the rest, so each sort has its own order.
      const owned = [
        row('mine-starred', { ownerId: ME, updatedAt: day(2), favorites: [{ userId: ME }] }),
        row('other-starred', {
          ownerId: ME,
          updatedAt: day(9),
          lastOpenedAt: day(9),
          favorites: [{ userId: OTHER }]
        }),
        row('plain', { ownerId: ME, updatedAt: day(5), lastOpenedAt: day(20) })
      ]
      const cases = [
        ['updatedAt_desc', ['mine-starred', 'other-starred', 'plain']],
        ['lastOpenedAt_desc', ['mine-starred', 'plain', 'other-starred']]
      ] as const
      for (const [sort, expected] of cases) {
        const result = await searchDocuments(fakePrisma(owned), {
          ownerId: ME,
          requesterId: ME,
          sort,
          limit: 10,
          offset: 0
        })
        expect(slugs(result)).toEqual([...expected])
        expect(result.total).toBe(3)
        const bySlug = Object.fromEntries(result.docs.map((d: any) => [d.slug, d]))
        expect(bySlug['mine-starred'].isFavorite).toBe(true)
        expect(bySlug['other-starred'].isFavorite).toBe(false)
      }
    })

    test('Trash and the fleet keep a plain order with no Favorite pin', async () => {
      // ME's star sits on the older row, so a pin would put it first.
      const listed = [
        row('starred', {
          ownerId: ME,
          updatedAt: day(2),
          deletedAt: day(3),
          favorites: [{ userId: ME }]
        }),
        row('plain', { ownerId: ME, updatedAt: day(8), deletedAt: day(7) })
      ]
      const trash = await searchDocuments(fakePrisma(listed), {
        ownerId: ME,
        requesterId: ME,
        deleted: true,
        limit: 10,
        offset: 0
      })
      expect(slugs(trash)).toEqual(['plain', 'starred'])
      expect(trash.docs[0]).not.toHaveProperty('isFavorite')

      const live = listed.map((r) => ({ ...r, deletedAt: null }))
      const fleet = await searchDocuments(fakePrisma(live), {
        requesterId: ME,
        limit: 10,
        offset: 0
      })
      expect(slugs(fleet)).toEqual(['plain', 'starred'])
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

    test('private doc, no token → 403 sign-in-required', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ...mockDocumentMetadata,
        isPrivate: true,
        ownerId: 'user-123'
      })

      const response = await testServer.get('/api/documents/secret-doc')
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
      expect(data.access).toBe('sign-in-required')
    })

    test('private doc, signed-in non-owner → 403 denied', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ...mockDocumentMetadata,
        isPrivate: true,
        ownerId: 'someone-else'
      })

      const response = await testServer.get('/api/documents/secret-doc', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.access).toBe('denied')
    })

    test('private doc, owner → 200 full metadata', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ...mockDocumentMetadata,
        isPrivate: true,
        ownerId: 'user-123'
      })

      const response = await testServer.get('/api/documents/secret-doc', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('slug')
      expect(data.data.isPrivate).toBe(true)
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
    // `requireUser` runs before validation, and this harness has no live Supabase to mint
    // a verified user, so these tests assert the 401 auth gate and not the create path.
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

  describe('POST /api/documents with service-role content', () => {
    // Read the effective key rather than a literal: a developer shell that
    // exports a real one wins over the test preload's default.
    const SERVICE_AUTH = { Authorization: `Bearer ${config.supabase.serviceRoleKey}` }
    const titleContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Seeded' }] }
      ]
    }

    test('a user JWT presenting content is forbidden and writes nothing', async () => {
      let created = false
      mockPrisma.documentMetadata.create = async () => {
        created = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents',
        { ...validDocument, content: titleContent },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
      expect(created).toBe(false)
    })

    test('a user JWT presenting ownerId is forbidden', async () => {
      const response = await testServer.post(
        '/api/documents',
        { ...validDocument, ownerId: 'someone-else' },
        { token: 'valid-test-token' }
      )

      expect(response.status).toBe(403)
    })

    test('service role writes metadata and version 1 in one transaction', async () => {
      let metaCreate: any
      let docsCreate: any
      let transactions = 0
      const originalTransaction = mockPrisma.$transaction
      mockPrisma.$transaction = async (arg: any) => {
        transactions += 1
        return originalTransaction(arg)
      }
      mockPrisma.documentMetadata.create = async (args: any) => {
        metaCreate = args
        return { id: 1, ...args.data, createdAt: new Date() }
      }
      mockPrisma.documents.create = async (args: any) => {
        docsCreate = args
        return { id: 1, ...args.data }
      }

      const response = await testServer.post(
        '/api/documents',
        { ...validDocument, content: titleContent, ownerId: 'owner-abc' },
        SERVICE_AUTH
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(transactions).toBe(1)
      expect(data.data.documentId).toMatch(/^[0-9A-Za-z]{19}$/)
      expect(metaCreate.data.ownerId).toBe('owner-abc')
      expect(docsCreate.data.version).toBe(1)
      expect(docsCreate.data.documentId).toBe(metaCreate.data.documentId)
      expect(docsCreate.data.data.byteLength).toBeGreaterThan(0)
    })

    test('invalid content is 422 and never creates the metadata row', async () => {
      let created = false
      mockPrisma.documentMetadata.create = async () => {
        created = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents',
        {
          ...validDocument,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'no title' }] }]
          }
        },
        SERVICE_AUTH
      )
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toHaveProperty('code', 'UNPROCESSABLE_ENTITY')
      expect(created).toBe(false)
    })

    test('an over-cap body is 413 before either row is written', async () => {
      let metaCreated = false
      let docCreated = false
      mockPrisma.documentMetadata.create = async () => {
        metaCreated = true
        return {}
      }
      mockPrisma.documents.create = async () => {
        docCreated = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents',
        {
          ...validDocument,
          content: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'x'.repeat(5 * 1024 * 1024 + 1024) }]
              }
            ]
          }
        },
        SERVICE_AUTH
      )
      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data.error).toHaveProperty('code', 'PAYLOAD_TOO_LARGE')
      expect(metaCreated).toBe(false)
      expect(docCreated).toBe(false)
    })

    test('a taken slug conflicts rather than being silently renamed', async () => {
      mockPrisma.documentMetadata.create = async () => {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      }

      const response = await testServer.post(
        '/api/documents',
        { ...validDocument, content: titleContent },
        SERVICE_AUTH
      )
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toHaveProperty('code', 'CONFLICT')
    })

    test('service role without content keeps the plain create path and honours ownerId', async () => {
      let metaCreate: any
      let docCreated = false
      mockPrisma.documentMetadata.create = async (args: any) => {
        metaCreate = args
        return { id: 1, ...args.data }
      }
      mockPrisma.documents.create = async () => {
        docCreated = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents',
        { ...validDocument, ownerId: 'owner-xyz' },
        SERVICE_AUTH
      )

      expect(response.status).toBe(200)
      expect(metaCreate.data.ownerId).toBe('owner-xyz')
      expect(docCreated).toBe(false)
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

    test('should update isPrivate flag when owner', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        readOnly: false,
        isPrivate: false
      })
      mockPrisma.documentMetadata.upsert = async (data: any) => ({
        id: 1,
        documentId: 'abc123',
        isPrivate: data.update.isPrivate,
        readOnly: false,
        keywords: ''
      })

      const response = await testServer.put(
        '/api/documents/abc123',
        { isPrivate: true },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isPrivate).toBe(true)
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

  describe('DELETE /api/documents/:documentId (soft-delete)', () => {
    test('rejects delete without authentication', async () => {
      const response = await testServer.delete('/api/documents/abc123')
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('non-owner delete is forbidden and never writes', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'someone-else' })
      let updated = false
      mockPrisma.documentMetadata.update = async () => {
        updated = true
        return {}
      }

      const response = await testServer.delete('/api/documents/abc123', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
      expect(updated).toBe(false)
    })

    test('ownerless doc delete is forbidden and never writes', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: null })
      let updated = false
      mockPrisma.documentMetadata.update = async () => {
        updated = true
        return {}
      }

      const response = await testServer.delete('/api/documents/abc123', {
        token: 'valid-test-token'
      })

      expect(response.status).toBe(403)
      expect(updated).toBe(false)
    })

    test('owner delete soft-deletes and sets deletedAt', async () => {
      let captured: any
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'user-123' })
      mockPrisma.documentMetadata.update = async (args: any) => {
        captured = args
        return { id: 1, documentId: 'abc123', deletedAt: args.data.deletedAt }
      }

      const response = await testServer.delete('/api/documents/abc123', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(captured.where).toEqual({ documentId: 'abc123' })
      expect(captured.data.deletedAt).toBeInstanceOf(Date)
    })

    test('re-delete after the row is gone (P2025) still succeeds', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'user-123' })
      mockPrisma.documentMetadata.update = async () => {
        throw { code: 'P2025' }
      }

      const response = await testServer.delete('/api/documents/abc123', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/documents/:documentId/restore', () => {
    test('rejects restore without authentication', async () => {
      const response = await testServer.post('/api/documents/abc123/restore', {})
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('non-owner restore is forbidden', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'someone-else' })
      let updated = false
      mockPrisma.documentMetadata.update = async () => {
        updated = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents/abc123/restore',
        {},
        { token: 'valid-test-token' }
      )

      expect(response.status).toBe(403)
      expect(updated).toBe(false)
    })

    test('owner restore clears deletedAt', async () => {
      let captured: any
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'user-123' })
      mockPrisma.documentMetadata.update = async (args: any) => {
        captured = args
        return { id: 1, documentId: 'abc123', deletedAt: null }
      }

      const response = await testServer.post(
        '/api/documents/abc123/restore',
        {},
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(captured.data.deletedAt).toBeNull()
    })
  })

  describe('POST /api/documents/:documentId/duplicate', () => {
    test('rejects duplicate without authentication', async () => {
      const response = await testServer.post('/api/documents/abc123/duplicate', {})
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('non-owner duplicate is forbidden and never writes', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'someone-else' })
      let created = false
      mockPrisma.documentMetadata.create = async () => {
        created = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents/abc123/duplicate',
        {},
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
      expect(created).toBe(false)
    })

    test('soft-deleted source is rejected as not found', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        title: 'Doc',
        deletedAt: new Date()
      })
      let created = false
      mockPrisma.documentMetadata.create = async () => {
        created = true
        return {}
      }

      const response = await testServer.post(
        '/api/documents/abc123/duplicate',
        {},
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toHaveProperty('code', 'NOT_FOUND')
      expect(created).toBe(false)
    })

    test('owner duplicate creates a copy with reset flags, media-less bytes unchanged', async () => {
      const sourceBytes = Buffer.from([1, 2, 3, 4])
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        title: 'My Notes',
        description: 'desc',
        keywords: 'a,b',
        deletedAt: null
      })
      mockPrisma.documents.findFirst = async () => ({ data: sourceBytes })

      let metaCreate: any
      let docsCreate: any
      mockPrisma.documentMetadata.create = async (args: any) => {
        metaCreate = args
        return { id: 2, ...args.data }
      }
      mockPrisma.documents.create = async (args: any) => {
        docsCreate = args
        return { id: 9, ...args.data }
      }

      const response = await testServer.post(
        '/api/documents/abc123/duplicate',
        {},
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // New metadata: fresh id, (copy) title, owner = requester, flags reset.
      expect(metaCreate.data.documentId).not.toBe('abc123')
      expect(metaCreate.data.title).toBe('My Notes (copy)')
      expect(metaCreate.data.ownerId).toBe('user-123')
      expect(metaCreate.data.isPrivate).toBe(false)
      expect(metaCreate.data.readOnly).toBe(false)
      expect(metaCreate.data.deletedAt).toBeNull()

      // No media to re-host, so the snapshot is passed through untouched; a source
      // WITH media has its URLs repointed at the copy's prefix (rehostMediaUrls).
      expect(docsCreate.data.version).toBe(1)
      expect(docsCreate.data.commitMessage).toBe('')
      expect(docsCreate.data.data).toBe(sourceBytes)
      expect(docsCreate.data.documentId).toBe(metaCreate.data.documentId)

      expect(data.data.documentId).toBe(metaCreate.data.documentId)
      expect(data.data.title).toBe('My Notes (copy)')
      expect(data.data).toHaveProperty('slug')
    })
  })

  describe('DELETE /api/documents/:documentId/permanent', () => {
    test('rejects permanent delete without authentication', async () => {
      const response = await testServer.delete('/api/documents/abc123/permanent')
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('non-owner permanent delete is forbidden and never purges', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'someone-else',
        slug: 'their-doc',
        deletedAt: new Date()
      })

      const response = await testServer.delete('/api/documents/abc123/permanent', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
      expect(purgeCalls).toHaveLength(0)
    })

    test('permanent delete of a live (non-deleted) doc is rejected and never purges', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        slug: 'live-doc',
        deletedAt: null
      })

      const response = await testServer.delete('/api/documents/abc123/permanent', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toHaveProperty('code', 'BAD_REQUEST')
      expect(purgeCalls).toHaveLength(0)
    })

    test('owner permanent delete of a soft-deleted doc purges the footprint', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        slug: 'my-slug',
        deletedAt: new Date()
      })

      const response = await testServer.delete('/api/documents/abc123/permanent', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // The purge path runs and receives the row's own slug.
      expect(purgeCalls).toHaveLength(1)
      expect(purgeCalls[0]).toMatchObject({ documentId: 'abc123', slug: 'my-slug' })
    })

    test('permanent delete of an already-gone doc is idempotent success', async () => {
      mockPrisma.documentMetadata.findUnique = async () => null

      const response = await testServer.delete('/api/documents/abc123/permanent', {
        token: 'valid-test-token'
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(purgeCalls).toHaveLength(0)
    })
  })

  describe('POST /api/documents/trash/purge (bulk / empty trash)', () => {
    test('rejects without authentication', async () => {
      const response = await testServer.post('/api/documents/trash/purge', {})
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('empty trash (no ids) purges every owned soft-deleted doc, owner-scoped', async () => {
      let findManyArgs: any
      mockPrisma.documentMetadata.findMany = async (args: any) => {
        findManyArgs = args
        return [{ documentId: 'a1' }, { documentId: 'b2' }, { documentId: 'c3' }]
      }
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        slug: 'slug',
        deletedAt: new Date()
      })

      const response = await testServer.post(
        '/api/documents/trash/purge',
        {},
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.purged).toBe(3)
      expect(purgeCalls).toHaveLength(3)
      expect(purgeCalls.map((c) => c.documentId)).toEqual(['a1', 'b2', 'c3'])
      // The empty-all query MUST stay scoped to the caller + soft-deleted rows —
      // dropping either turns "empty my trash" into a cross-tenant / live-doc purge.
      expect(findManyArgs.where.ownerId).toBe('user-123')
      expect(findManyArgs.where.deletedAt).toEqual({ not: null })
    })

    test('purges only the selected ids (never queries the whole trash)', async () => {
      let findManyCalled = false
      mockPrisma.documentMetadata.findMany = async () => {
        findManyCalled = true
        return []
      }
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        slug: 's',
        deletedAt: new Date()
      })

      const response = await testServer.post(
        '/api/documents/trash/purge',
        { ids: ['a1', 'b2'] },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.purged).toBe(2)
      expect(purgeCalls.map((c) => c.documentId)).toEqual(['a1', 'b2'])
      expect(findManyCalled).toBe(false)
    })

    test('skips non-owned ids in a selection; count reflects purged only', async () => {
      mockPrisma.documentMetadata.findUnique = async (args: any) =>
        args.where.documentId === 'mine'
          ? { ownerId: 'user-123', slug: 's', deletedAt: new Date() }
          : { ownerId: 'someone-else', slug: 'x', deletedAt: new Date() }

      const response = await testServer.post(
        '/api/documents/trash/purge',
        { ids: ['mine', 'theirs'] },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.purged).toBe(1)
      expect(purgeCalls).toHaveLength(1)
      expect(purgeCalls[0].documentId).toBe('mine')
    })
  })

  describe('POST /api/documents/trash/restore (bulk)', () => {
    test('rejects without authentication', async () => {
      const response = await testServer.post('/api/documents/trash/restore', { ids: ['a1'] })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('requires a non-empty ids array', async () => {
      const response = await testServer.post(
        '/api/documents/trash/restore',
        { ids: [] },
        { token: 'valid-test-token' }
      )

      expect(response.status).toBe(400)
    })

    test('restores each owned id and clears deletedAt', async () => {
      const updated: string[] = []
      mockPrisma.documentMetadata.findUnique = async () => ({ ownerId: 'user-123' })
      mockPrisma.documentMetadata.update = async (args: any) => {
        updated.push(args.where.documentId)
        expect(args.data.deletedAt).toBeNull()
        return {}
      }

      const response = await testServer.post(
        '/api/documents/trash/restore',
        { ids: ['a1', 'b2'] },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.restored).toBe(2)
      expect(updated).toEqual(['a1', 'b2'])
    })

    test('skips non-owned ids; count reflects restored only', async () => {
      mockPrisma.documentMetadata.findUnique = async (args: any) =>
        args.where.documentId === 'mine' ? { ownerId: 'user-123' } : { ownerId: 'someone-else' }
      let updates = 0
      mockPrisma.documentMetadata.update = async () => {
        updates += 1
        return {}
      }

      const response = await testServer.post(
        '/api/documents/trash/restore',
        { ids: ['mine', 'theirs'] },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.restored).toBe(1)
      expect(updates).toBe(1)
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

  describe('PUT /api/documents/:documentId/favorite', () => {
    test('rejects a missing token', async () => {
      const response = await testServer.put('/api/documents/doc-1/favorite', { favorite: true })
      const data = await response.json()
      expect(response.status).toBe(401)
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED')
    })

    test('rejects a missing favorite field', async () => {
      const response = await testServer.put(
        '/api/documents/doc-1/favorite',
        {},
        { token: 'valid-test-token' }
      )
      expect(response.status).toBe(400)
    })

    test('upserts when the owner favorites a live document', async () => {
      let upserted: any
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        deletedAt: null
      })
      mockPrisma.documentFavorite.upsert = async (args: any) => {
        upserted = args
        return args.create
      }

      const response = await testServer.put(
        '/api/documents/doc-1/favorite',
        { favorite: true },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual({ documentId: 'doc-1', isFavorite: true })
      expect(upserted.create).toEqual({ documentId: 'doc-1', userId: 'user-123' })
    })

    test('deletes the join row when the owner unfavorites', async () => {
      let deleted: any
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        deletedAt: null
      })
      mockPrisma.documentFavorite.deleteMany = async (args: any) => {
        deleted = args
        return { count: 1 }
      }

      const response = await testServer.put(
        '/api/documents/doc-1/favorite',
        { favorite: false },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual({ documentId: 'doc-1', isFavorite: false })
      expect(deleted.where).toEqual({ documentId: 'doc-1', userId: 'user-123' })
    })

    test('forbids a non-owner', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'other-user',
        deletedAt: null
      })

      const response = await testServer.put(
        '/api/documents/doc-1/favorite',
        { favorite: true },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toHaveProperty('code', 'FORBIDDEN')
    })

    test('returns 404 for a missing or soft-deleted document', async () => {
      mockPrisma.documentMetadata.findUnique = async () => ({
        ownerId: 'user-123',
        deletedAt: new Date()
      })

      const response = await testServer.put(
        '/api/documents/doc-1/favorite',
        { favorite: true },
        { token: 'valid-test-token' }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toHaveProperty('code', 'NOT_FOUND')
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
