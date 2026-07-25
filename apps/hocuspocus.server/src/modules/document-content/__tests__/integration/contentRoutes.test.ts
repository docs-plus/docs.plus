import { beforeEach, describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, TestServer } from '../../../../../tests/helpers/test-server'
import { migrationExtensions } from '../../../../lib/migration-extensions'
import { createRouter } from '../../http/router'
import type { ApplyRequest, TiptapDocJson, WsApplyOutcome } from '../../types'
import { MAX_CONTENT_BYTES } from '../../types'

const SERVICE_KEY = 'integration-service-role-key'
const AUTH = { Authorization: `Bearer ${SERVICE_KEY}` }
const DOCUMENT_ID = 'abcdefghij123456789'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const snapshotBytes = (content: Record<string, unknown>[]): Buffer =>
  Buffer.from(
    Y.encodeStateAsUpdate(
      TiptapTransformer.toYdoc({ type: 'doc', content }, 'default', migrationExtensions)
    )
  )

const titleDoc = (text = 'Injected'): TiptapDocJson => ({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }]
})

interface Harness {
  server: TestServer
  prisma: any
  wsCalls: ApplyRequest[]
  setOutcome: (outcome: WsApplyOutcome) => void
  queries: string[]
}

const harness = (options: { serviceRoleEnabled?: boolean } = {}): Harness => {
  const prisma = createMockPrisma() as any
  const wsCalls: ApplyRequest[] = []
  const queries: string[] = []
  let outcome: WsApplyOutcome = { status: 'applied' }

  const originalFindUnique = prisma.documentMetadata.findUnique
  prisma.documentMetadata.findUnique = async (args: any) => {
    queries.push('documentMetadata.findUnique')
    return originalFindUnique(args)
  }
  const originalFindFirst = prisma.documents.findFirst
  prisma.documents.findFirst = async (args: any) => {
    queries.push('documents.findFirst')
    return originalFindFirst(args)
  }

  const app = new Hono()
  app.use('*', requestId())
  app.route(
    '/api/documents',
    createRouter({
      prisma,
      logger: silentLogger,
      verifyServiceRole: (header) =>
        options.serviceRoleEnabled === false ? false : header === `Bearer ${SERVICE_KEY}`,
      wsApply: async (request) => {
        wsCalls.push(request)
        return outcome
      }
    })
  )

  return {
    server: new TestServer(app),
    prisma,
    wsCalls,
    queries,
    setOutcome: (next) => {
      outcome = next
    }
  }
}

const liveMeta = {
  documentId: DOCUMENT_ID,
  slug: 'injected-doc',
  ownerId: 'owner-1',
  email: 'owner@example.com',
  deletedAt: null
}

describe('Document content routes — authorization', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
    h.prisma.documentMetadata.findUnique = async () => liveMeta
  })

  test('rejects a missing bearer', async () => {
    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toHaveProperty('code', 'UNAUTHORIZED')
  })

  test('rejects a wrong bearer', async () => {
    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`, {
      Authorization: 'Bearer nope'
    })
    expect(response.status).toBe(401)
  })

  test('rejects a bare user JWT on PATCH', async () => {
    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: titleDoc() },
      { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.user.jwt' }
    )
    expect(response.status).toBe(401)
    expect(h.wsCalls).toHaveLength(0)
  })

  test('fails closed when the service-role key is unset', async () => {
    const closed = harness({ serviceRoleEnabled: false })
    closed.prisma.documentMetadata.findUnique = async () => liveMeta

    const response = await closed.server.get(`/api/documents/${DOCUMENT_ID}/content`, AUTH)
    expect(response.status).toBe(401)
  })
})

describe('Document content routes — documentId shape guard', () => {
  test('rejects a non-19-char id before any database round-trip', async () => {
    const h = harness()
    const response = await h.server.get('/api/documents/short-id/content', AUTH)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR')
    expect(h.queries).toHaveLength(0)
  })

  test('rejects a traversal-shaped id before any database round-trip', async () => {
    const h = harness()
    const response = await h.server.get('/api/documents/%2E%2E%2Fmetrics/content', AUTH)

    expect(response.status).toBe(400)
    expect(h.queries).toHaveLength(0)
  })
})

describe('GET /api/documents/:documentId/content', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
    h.prisma.documentMetadata.findUnique = async () => liveMeta
  })

  test('returns the persisted head as Tiptap JSON', async () => {
    h.prisma.documents.findFirst = async () => ({
      version: 7,
      data: snapshotBytes([
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] }
      ])
    })

    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.version).toBe(7)
    expect(body.data.format).toBe('json')
    expect(body.data.documentId).toBe(DOCUMENT_ID)
    expect(body.data.content.type).toBe('doc')
    expect(body.data.content.content.map((n: any) => n.type)).toEqual(['heading', 'paragraph'])
  })

  test('extracts block text across headings, paragraphs and task items', async () => {
    h.prisma.documents.findFirst = async () => ({
      version: 2,
      data: snapshotBytes([
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }]
            }
          ]
        }
      ])
    })

    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content?format=text`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.format).toBe('text')
    expect(body.data.content).toBe('Title\nfirst\ntodo')
  })

  test('returns version 0 and an empty body for a document with no snapshot row', async () => {
    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.version).toBe(0)
    expect(body.data.content).toEqual({ type: 'doc', content: [] })
  })

  test('returns an empty string for a snapshot-less document in text format', async () => {
    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content?format=text`, AUTH)
    const body = await response.json()

    expect(body.data.content).toBe('')
  })

  test('404s an unknown document', async () => {
    h.prisma.documentMetadata.findUnique = async () => null

    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toHaveProperty('code', 'NOT_FOUND')
  })

  test('404s a tombstoned document', async () => {
    h.prisma.documentMetadata.findUnique = async () => ({ ...liveMeta, deletedAt: new Date() })

    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`, AUTH)
    expect(response.status).toBe(404)
  })

  test('500s on undecodable snapshot bytes', async () => {
    h.prisma.documents.findFirst = async () => ({ version: 3, data: Buffer.from([9, 9, 9, 9]) })

    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toHaveProperty('code', 'INTERNAL_SERVER_ERROR')
  })

  test('rejects an unsupported format in the canonical envelope', async () => {
    const response = await h.server.get(`/api/documents/${DOCUMENT_ID}/content?format=yjs`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } })
  })
})

describe('PATCH /api/documents/:documentId/content', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
    h.prisma.documentMetadata.findUnique = async () => liveMeta
  })

  test('forwards mode and content to the internal endpoint unchanged', async () => {
    const content = titleDoc('Forwarded')

    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content?mode=append`,
      { content },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: DOCUMENT_ID, mode: 'append' })
    expect(h.wsCalls).toHaveLength(1)
    expect(h.wsCalls[0].documentId).toBe(DOCUMENT_ID)
    expect(h.wsCalls[0].mode).toBe('append')
    expect(h.wsCalls[0].content).toEqual(content)
  })

  test('defaults the mode to replace', async () => {
    await h.server.patch(`/api/documents/${DOCUMENT_ID}/content`, { content: titleDoc() }, AUTH)
    expect(h.wsCalls[0].mode).toBe('replace')
  })

  test('404s an unknown document without hopping to the WS process', async () => {
    h.prisma.documentMetadata.findUnique = async () => null

    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: titleDoc() },
      AUTH
    )

    expect(response.status).toBe(404)
    expect(h.wsCalls).toHaveLength(0)
  })

  test('404s a tombstoned document without hopping to the WS process', async () => {
    h.prisma.documentMetadata.findUnique = async () => ({ ...liveMeta, deletedAt: new Date() })

    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: titleDoc() },
      AUTH
    )

    expect(response.status).toBe(404)
    expect(h.wsCalls).toHaveLength(0)
  })

  test('rejects an unsupported mode', async () => {
    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content?mode=delete`,
      { content: titleDoc() },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR')
    expect(h.wsCalls).toHaveLength(0)
  })

  test('rejects an empty content array', async () => {
    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: { type: 'doc', content: [] } },
      AUTH
    )

    expect(response.status).toBe(400)
    expect(h.wsCalls).toHaveLength(0)
  })

  test('passes an invalid-content outcome through as 422', async () => {
    h.setOutcome({ status: 'invalid-content', detail: 'unknown node type: widget' })

    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: titleDoc() },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'unknown node type: widget'
    })
  })

  test('maps a persist failure to a 500 that warns about live visibility', async () => {
    h.setOutcome({ status: 'persist-failed' })

    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: titleDoc() },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(body.error.message).toContain('wedged')
  })

  test('maps an unreachable WS process to 503', async () => {
    h.setOutcome({ status: 'unreachable' })

    const response = await h.server.patch(
      `/api/documents/${DOCUMENT_ID}/content`,
      { content: titleDoc() },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toHaveProperty('code', 'SERVICE_UNAVAILABLE')
  })

  test('rejects a body over the byte cap before it reaches the WS process', async () => {
    const oversized = {
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x'.repeat(MAX_CONTENT_BYTES + 1024) }]
          }
        ]
      }
    }

    const response = await h.server.patch(`/api/documents/${DOCUMENT_ID}/content`, oversized, AUTH)
    const body = await response.json()

    expect(response.status).toBe(413)
    expect(body.error).toHaveProperty('code', 'PAYLOAD_TOO_LARGE')
    expect(h.wsCalls).toHaveLength(0)
  })
})
