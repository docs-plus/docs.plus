import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from '@hocuspocus/extension-database'
import { Hocuspocus } from '@hocuspocus/server'
import { TiptapTransformer } from '@hocuspocus/transformer'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, TestServer } from '../../../../../tests/helpers/test-server'
import { createInternalApp } from '../../http/internalApp'
import { createApplyContent } from '../../infra/hocuspocusApply'
import type { TiptapDocJson } from '../../types'

const SERVICE_KEY = 'internal-service-role-key'
const AUTH = { Authorization: `Bearer ${SERVICE_KEY}` }
const COLD_DOC = 'coldDocument12345AB'
const LIVE_DOC = 'liveDocument12345AB'
const WEDGED_DOC = 'wedgedDocument123AB'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

/** Mirrors the production Database `fetch` default for a document with no rows. */
const draftDefaultState = (): Uint8Array => {
  const ydoc = new Y.Doc()
  const meta = ydoc.getMap('metadata')
  meta.set('needsInitialization', true)
  meta.set('isDraft', true)
  return Y.encodeStateAsUpdate(ydoc)
}

const titleDoc = (text: string): TiptapDocJson => ({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }]
})

const paragraphDoc = (text: string): TiptapDocJson => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
})

const decodeState = (state: Uint8Array) => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, state)
  return {
    json: TiptapTransformer.fromYdoc(ydoc, 'default') as { content: Record<string, any>[] },
    metadata: ydoc.getMap('metadata').toJSON() as Record<string, unknown>
  }
}

interface StoreCall {
  documentName: string
  state: Uint8Array
  context: Record<string, any>
}

const persisted = new Map<string, Uint8Array>()
const storeCalls: StoreCall[] = []
const rejectingDocuments = new Set<string>()

const database = new Database({
  fetch: async ({ documentName }) => persisted.get(documentName) ?? draftDefaultState(),
  store: async ({ documentName, state, context }) => {
    storeCalls.push({ documentName, state, context })
    if (rejectingDocuments.has(documentName)) throw new Error('forced store failure')
    persisted.set(documentName, state)
  }
})

// Production debounce values: `transact()` and `disconnect()` both store
// immediately, so nothing is left pending between tests.
const hocuspocus = new Hocuspocus({ extensions: [database], debounce: 10_000, maxDebounce: 60_000 })

const metaRows = new Map<string, Record<string, unknown> | null>()
const prisma = createMockPrisma() as any
prisma.documentMetadata.findUnique = async (args: any) =>
  metaRows.get(args.where.documentId) ?? null

const app = createInternalApp({
  verifyServiceRole: (header) => header === `Bearer ${SERVICE_KEY}`,
  applyContent: createApplyContent({ hocuspocus, prisma, logger: silentLogger }),
  logger: silentLogger
})
const server = new TestServer(app)

const applyPath = (documentId: string) => `/internal/documents/${documentId}/content`

const liveMeta = (documentId: string, slug: string) => ({
  documentId,
  slug,
  ownerId: 'owner-9',
  email: 'owner@example.com',
  deletedAt: null
})

beforeEach(() => {
  storeCalls.length = 0
})

describe('Internal content apply — authorization and existence', () => {
  test('rejects a request without the service-role bearer', async () => {
    metaRows.set(COLD_DOC, liveMeta(COLD_DOC, 'cold-doc'))

    const response = await server.post(applyPath(COLD_DOC), {
      mode: 'replace',
      content: titleDoc('nope')
    })

    expect(response.status).toBe(401)
    expect(storeCalls).toHaveLength(0)
  })

  test('404s a document with no metadata row', async () => {
    metaRows.set('missingDocument12AB', null)

    const response = await server.post(
      applyPath('missingDocument12AB'),
      { mode: 'replace', content: titleDoc('nope') },
      AUTH
    )

    expect(response.status).toBe(404)
    expect(storeCalls).toHaveLength(0)
  })

  test('404s a tombstoned document', async () => {
    metaRows.set('tombstonedDoc1234AB', {
      ...liveMeta('tombstonedDoc1234AB', 'gone'),
      deletedAt: new Date()
    })

    const response = await server.post(
      applyPath('tombstonedDoc1234AB'),
      { mode: 'replace', content: titleDoc('nope') },
      AUTH
    )

    expect(response.status).toBe(404)
    expect(storeCalls).toHaveLength(0)
  })

  test('canonical 404 envelope on an unknown internal path', async () => {
    const response = await server.post('/internal/nope', {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('Internal content apply — cold document', () => {
  beforeEach(() => {
    persisted.clear()
    metaRows.set(COLD_DOC, liveMeta(COLD_DOC, 'cold-doc'))
  })

  test('persists the injected content with the draft flag cleared at store time', async () => {
    const response = await server.post(
      applyPath(COLD_DOC),
      { mode: 'replace', content: titleDoc('Cold inject') },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: COLD_DOC, mode: 'replace' })

    expect(storeCalls.length).toBeGreaterThan(0)
    const { json, metadata } = decodeState(storeCalls[0].state)
    // store() refuses to persist while isDraft is truthy — skipping the clear
    // would evaporate every injected byte.
    expect(metadata.isDraft).toBe(false)
    expect(metadata.needsInitialization).toBe(false)
    expect(json.content[0].content[0].text).toBe('Cold inject')
  })

  test('passes a WS-shaped context so a rowless first save mints correct metadata', async () => {
    await server.post(applyPath(COLD_DOC), { mode: 'replace', content: titleDoc('ctx') }, AUTH)

    expect(storeCalls[0].context).toMatchObject({
      slug: 'cold-doc',
      documentId: COLD_DOC,
      deviceType: 'service',
      user: { sub: 'owner-9' }
    })
  })

  test('rejects structurally invalid content as 422 and writes nothing', async () => {
    const response = await server.post(
      applyPath(COLD_DOC),
      {
        mode: 'replace',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'T' }] },
            { type: 'image', attrs: { src: 'https://cdn.test/a.png' } }
          ]
        }
      },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toHaveProperty('code', 'UNPROCESSABLE_ENTITY')
    expect(storeCalls).toHaveLength(0)
  })

  test('rejects a heading-less replace payload as 422', async () => {
    const response = await server.post(
      applyPath(COLD_DOC),
      { mode: 'replace', content: paragraphDoc('no title') },
      AUTH
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error.message).toContain('level-1 heading')
    expect(storeCalls).toHaveLength(0)
  })

  test('rejects a heading-less append into an empty document as 422 and adds no content', async () => {
    const response = await server.post(
      applyPath(COLD_DOC),
      { mode: 'append', content: paragraphDoc('appended first') },
      AUTH
    )

    expect(response.status).toBe(422)
    // Emptiness is only knowable once the document is open, so the release
    // disconnect still flushes. The disconnect flushes the unchanged document,
    // and production's store() skips a draft outright.
    for (const call of storeCalls) {
      expect(decodeState(call.state).json.content).toHaveLength(0)
    }
  })
})

describe('Internal content apply — live document', () => {
  test('a held direct connection observes the injected content on the same Y.Doc', async () => {
    persisted.clear()
    metaRows.set(LIVE_DOC, liveMeta(LIVE_DOC, 'live-doc'))

    const held = await hocuspocus.openDirectConnection(LIVE_DOC, { slug: 'live-doc' })
    try {
      await server.post(
        applyPath(LIVE_DOC),
        { mode: 'replace', content: titleDoc('Live inject') },
        AUTH
      )

      const fragment = held.document?.getXmlFragment('default')
      expect(fragment?.length).toBe(1)
      expect(fragment?.toArray()[0].toString()).toContain('Live inject')
    } finally {
      await held.disconnect()
    }
  })

  test('append extends the live document instead of replacing it', async () => {
    persisted.clear()
    metaRows.set(LIVE_DOC, liveMeta(LIVE_DOC, 'live-doc'))

    await server.post(applyPath(LIVE_DOC), { mode: 'replace', content: titleDoc('Base') }, AUTH)
    await server.post(applyPath(LIVE_DOC), { mode: 'append', content: paragraphDoc('extra') }, AUTH)

    const { json } = decodeState(persisted.get(LIVE_DOC) as Uint8Array)
    expect(json.content.map((node) => node.type)).toEqual(['heading', 'paragraph'])
    expect(json.content[1].content[0].text).toBe('extra')
  })
})

describe('Internal content apply — wedged persistence', () => {
  test('a rejecting store yields the crafted 500 on this call and the next', async () => {
    metaRows.set(WEDGED_DOC, liveMeta(WEDGED_DOC, 'wedged-doc'))
    rejectingDocuments.add(WEDGED_DOC)

    const first = await server.post(
      applyPath(WEDGED_DOC),
      { mode: 'replace', content: titleDoc('first') },
      AUTH
    )
    const firstBody = await first.json()

    expect(first.status).toBe(500)
    expect(firstBody.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(firstBody.error.message).toContain('wedged')

    // Stop the store rejecting before the second call. The debouncer never
    // cleared the failed execution, so the document stays wedged on its own.
    // Leaving the store rejecting would let a healthy server pass this too.
    rejectingDocuments.delete(WEDGED_DOC)
    const storeCallsBefore = storeCalls.length

    const second = await server.post(
      applyPath(WEDGED_DOC),
      { mode: 'replace', content: titleDoc('second') },
      AUTH
    )
    const secondBody = await second.json()

    expect(second.status).toBe(500)
    expect(secondBody.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(secondBody.error.message).toContain('wedged')
    // The Database hook is never reached again — that is the wedge.
    expect(storeCalls.length).toBe(storeCallsBefore)
  })
})
