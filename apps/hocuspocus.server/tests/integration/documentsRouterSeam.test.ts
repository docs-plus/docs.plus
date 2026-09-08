// Drives the documents router through `createDocumentsRouter`, so nothing here
// mocks a module. Auth and the notification arrive as deps, and Prisma arrives on
// the context the way production sets it. This file therefore has no order
// dependency on the sticky `mock.module` calls the other suites install.
import { describe, expect, test } from 'bun:test'
import { Hono, type MiddlewareHandler } from 'hono'

import {
  createDocumentsController,
  type DocumentsControllerDeps
} from '../../src/api/controllers/documents.controller'
import { createDocumentsRouter } from '../../src/api/routers/documents.router'
import { createMockPrisma, TestServer } from '../helpers/test-server'

// `NewDocumentEmailParams` is not exported, and its module belongs to another
// lane. Read the shape off the dep instead, which is the seam's own contract.
type NewDocumentParams = Parameters<DocumentsControllerDeps['notifyNewDocument']>[0]

const OWNER = 'owner-1'
const STRANGER = 'stranger-2'
const DOCUMENT_ID = 'doc-opened-1'

const TITLE_CONTENT = {
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Seeded' }] }]
}

/** Every route here is owner-scoped, so the stub only ever names one subject. */
const stubAuth =
  (userId: string, serviceRole = false): MiddlewareHandler =>
  async (c, next) => {
    if (serviceRole) c.set('serviceRole', true)
    c.set('user', { sub: userId, email: `${userId}@example.test` })
    c.set('userId', userId)
    await next()
  }

interface HarnessOptions {
  userId?: string
  serviceRole?: boolean
  notify?: (params: NewDocumentParams) => Promise<boolean>
}

const harness = (options: HarnessOptions = {}) => {
  const prisma = createMockPrisma() as any
  const notified: NewDocumentParams[] = []
  const opened: unknown[][] = []

  prisma.$executeRaw = async (...args: unknown[]) => {
    opened.push(args)
    return 1
  }

  const auth = stubAuth(options.userId ?? OWNER, options.serviceRole ?? false)
  const controller = createDocumentsController({
    notifyNewDocument:
      options.notify ??
      (async (params) => {
        notified.push(params)
        return true
      }),
    getOwnerProfile: async (userId) => ({
      id: userId,
      avatar_url: null,
      avatar_updated_at: null,
      full_name: null,
      display_name: 'Stubbed Owner',
      status: null
    })
  })

  const app = new Hono()
  // The same app-wide middleware `src/index.ts` runs, so the handlers read the
  // client off the context here exactly as they do in production.
  app.use('*', async (c, next) => {
    c.set('prisma', prisma)
    await next()
  })
  app.route(
    '/api/documents',
    createDocumentsRouter({
      controller,
      optionalUser: auth,
      requireUser: auth,
      requireServiceRoleOrUser: auth
    })
  )

  return { server: new TestServer(app), prisma, notified, opened }
}

const nextTick = () => new Promise((resolve) => setImmediate(resolve))

describe('POST /api/documents/:documentId/opened', () => {
  test('a non-owner is refused and stamps nothing', async () => {
    const { server, prisma, opened } = harness({ userId: STRANGER })
    prisma.documentMetadata.findUnique = async () => ({ ownerId: OWNER, deletedAt: null })

    const response = await server.post(`/api/documents/${DOCUMENT_ID}/opened`, {})
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toHaveProperty('code', 'FORBIDDEN')
    expect(opened).toEqual([])
  })

  // The owner check runs before the existence check, so a stranger cannot tell a
  // missing document from someone else's. Answering 404 here would leak that.
  test('a document with no row is refused, not reported missing', async () => {
    const { server, prisma, opened } = harness({ userId: STRANGER })
    prisma.documentMetadata.findUnique = async () => null

    const response = await server.post(`/api/documents/${DOCUMENT_ID}/opened`, {})

    expect(response.status).toBe(403)
    expect(opened).toEqual([])
  })

  test('the owner of a soft-deleted document gets 404 and stamps nothing', async () => {
    const { server, prisma, opened } = harness()
    prisma.documentMetadata.findUnique = async () => ({
      ownerId: OWNER,
      deletedAt: new Date('2026-01-01T00:00:00.000Z')
    })

    const response = await server.post(`/api/documents/${DOCUMENT_ID}/opened`, {})
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toHaveProperty('code', 'NOT_FOUND')
    expect(opened).toEqual([])
  })

  test('the owner stamps the requested document and no other', async () => {
    const { server, prisma, opened } = harness()
    prisma.documentMetadata.findUnique = async () => ({ ownerId: OWNER, deletedAt: null })

    const response = await server.post(`/api/documents/${DOCUMENT_ID}/opened`, {})
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: DOCUMENT_ID })
    expect(opened).toHaveLength(1)
    expect(opened[0]).toContain(DOCUMENT_ID)
  })
})

describe('POST /api/documents with service-role content', () => {
  test('the notification carries the minted documentId, which the request never sent', async () => {
    const { server, notified } = harness({ serviceRole: true })

    const response = await server.post('/api/documents', {
      title: 'Seeded',
      slug: 'seeded-doc',
      content: TITLE_CONTENT,
      ownerId: OWNER
    })
    const body = await response.json()
    await nextTick()

    expect(response.status).toBe(200)
    expect(body.data.documentId).toMatch(/^[0-9A-Za-z]{19}$/)
    // The stubbed profile proves the reply took the injected lookup, not Supabase.
    expect(body.data.ownerProfile.display_name).toBe('Stubbed Owner')
    expect(notified).toHaveLength(1)
    expect(notified[0]?.documentId).toBe(body.data.documentId)
    expect(notified[0]?.creatorId).toBe(OWNER)
  })

  test('a notification that rejects never reaches the caller or the process', async () => {
    const { server } = harness({
      serviceRole: true,
      notify: async () => {
        throw new Error('email queue down')
      }
    })

    const response = await server.post('/api/documents', {
      title: 'Seeded',
      slug: 'seeded-doc',
      content: TITLE_CONTENT,
      ownerId: OWNER
    })
    const body = await response.json()
    await nextTick()

    expect(response.status).toBe(200)
    expect(body.data.documentId).toMatch(/^[0-9A-Za-z]{19}$/)
  })
})
