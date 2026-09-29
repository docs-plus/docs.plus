import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from '@hocuspocus/extension-database'
import { Hocuspocus } from '@hocuspocus/server'
import { TiptapTransformer } from '@hocuspocus/transformer'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, TestServer } from '../../../../../tests/helpers/test-server'
import { stripSnapshotMetadata } from '../../../../lib/snapshotMetadata'
import { findSection } from '../../domain/sections'
import { createInternalApp } from '../../http/internalApp'
import { createApplyContent } from '../../infra/hocuspocusApply'
import type { TiptapDocJson } from '../../types'

const SERVICE_KEY = 'internal-service-role-key'
const AUTH = { Authorization: `Bearer ${SERVICE_KEY}` }
const COLD_DOC = 'coldDocument12345AB'
const LIVE_DOC = 'liveDocument12345AB'
const WEDGED_DOC = 'wedgedDocument123AB'
const SECTION_DOC = 'sectionDocument12AB'

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
const persistedVersions = new Map<string, number>()
const storeCalls: StoreCall[] = []
const rejectingDocuments = new Set<string>()

const database = new Database({
  fetch: async ({ documentName }) => persisted.get(documentName) ?? draftDefaultState(),
  store: async ({ documentName, state, context }) => {
    storeCalls.push({ documentName, state, context })
    if (rejectingDocuments.has(documentName)) throw new Error('forced store failure')
    persisted.set(documentName, state)
    persistedVersions.set(documentName, (persistedVersions.get(documentName) ?? 0) + 1)
  }
})

/** The head-row read the applier's commit wait polls, honouring `version: { gt }`. */
const headRowFrom =
  (read: (documentId: string) => { version: number; data: Uint8Array } | null) =>
  async (args: any) => {
    const head = read(args.where.documentId)
    const after = args.where.version?.gt
    if (!head || (after !== undefined && head.version <= after)) return null
    return { version: head.version, data: Buffer.from(head.data) }
  }

// Production debounce values: `transact()` and `disconnect()` both store
// immediately, so nothing is left pending between tests.
const hocuspocus = new Hocuspocus({ extensions: [database], debounce: 10_000, maxDebounce: 60_000 })

const metaRows = new Map<string, Record<string, unknown> | null>()
const prisma = createMockPrisma() as any
prisma.documentMetadata.findUnique = async (args: any) =>
  metaRows.get(args.where.documentId) ?? null
prisma.documents.findFirst = headRowFrom((documentId) => {
  const data = persisted.get(documentId)
  return data ? { version: persistedVersions.get(documentId) ?? 0, data } : null
})

const app = createInternalApp({
  verifyServiceRole: (header) => header === `Bearer ${SERVICE_KEY}`,
  applyContent: createApplyContent({ hocuspocus, prisma, logger: silentLogger }),
  hocuspocus,
  prisma,
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
    // The room unloaded, so the applier waited for the row and reports it.
    expect(body.data).toEqual({
      documentId: COLD_DOC,
      mode: 'replace',
      version: expect.any(Number)
    })

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
    // No clear: the held write above waits for a head row, and a real one never vanishes.
    metaRows.set(LIVE_DOC, liveMeta(LIVE_DOC, 'live-doc'))

    await server.post(applyPath(LIVE_DOC), { mode: 'replace', content: titleDoc('Base') }, AUTH)
    await server.post(applyPath(LIVE_DOC), { mode: 'append', content: paragraphDoc('extra') }, AUTH)

    const { json } = decodeState(persisted.get(LIVE_DOC) as Uint8Array)
    expect(json.content.map((node) => node.type)).toEqual(['heading', 'paragraph'])
    expect(json.content[1].content[0].text).toBe('extra')
  })
})

describe('Internal content apply — edits inside one section', () => {
  const sectionDoc = (): TiptapDocJson => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      {
        type: 'heading',
        attrs: { level: 2, 'toc-id': 'two' },
        content: [{ type: 'text', text: 'Two' }]
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'first line' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'second line' }] }
    ]
  })
  const persistedJson = () => decodeState(persisted.get(SECTION_DOC) as Uint8Array).json
  const texts = () =>
    persistedJson().content.map((node) =>
      (node.content ?? []).map((child: Record<string, any>) => child.text ?? '').join('')
    )

  test('a blocks insert and a text edit cross the hop; only the text edit returns a rev', async () => {
    metaRows.set(SECTION_DOC, liveMeta(SECTION_DOC, 'section-doc'))
    await server.post(applyPath(SECTION_DOC), { mode: 'replace', content: sectionDoc() }, AUTH)

    const rev = findSection(persistedJson(), 'two')?.rev
    const inserted = await server.post(
      applyPath(SECTION_DOC),
      { mode: 'blocks', sectionId: 'two', rev, from: 1, to: 1, content: paragraphDoc('middle') },
      AUTH
    )
    expect(inserted.status).toBe(200)
    expect((await inserted.json()).data.rev).toBeUndefined()
    const nextRev = findSection(persistedJson(), 'two')?.rev
    expect(texts()).toEqual(['Title', 'Two', 'first line', 'middle', 'second line'])

    const edited = await server.post(
      applyPath(SECTION_DOC),
      { mode: 'text', sectionId: 'two', rev: nextRev, oldText: 'second', newText: 'last' },
      AUTH
    )
    expect(edited.status).toBe(200)
    expect((await edited.json()).data.rev).toBe(findSection(persistedJson(), 'two')?.rev)
    expect(texts()).toEqual(['Title', 'Two', 'first line', 'middle', 'last line'])
  })

  test('a text mode without oldText is a 400, never a write', async () => {
    metaRows.set(SECTION_DOC, liveMeta(SECTION_DOC, 'section-doc'))
    const before = texts()
    const response = await server.post(
      applyPath(SECTION_DOC),
      { mode: 'text', sectionId: 'two', rev: '000000000000' },
      AUTH
    )
    expect(response.status).toBe(400)
    expect(texts()).toEqual(before)
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

describe('Internal content apply — the store worker lags (#229)', () => {
  const LAGGING_DOC = 'laggingDocument12AB'
  const WORKER_LAG_MS = 150

  const bodyDoc = (text: string): TiptapDocJson => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text }] }
    ]
  })

  test('two sequential replaces end with one body', async () => {
    const seed = TiptapTransformer.toYdoc(bodyDoc('seed'), 'default')
    const head = { version: 1, data: stripSnapshotMetadata(Y.encodeStateAsUpdate(seed)) }

    // The store hook only enqueues; the worker merges raw onto the head and
    // strips the result later, as production does. The unload then leaves a
    // window where the next open reads a head without the last write.
    const laggingDatabase = new Database({
      fetch: async () => head.data,
      store: async ({ state }) => {
        setTimeout(() => {
          head.data = stripSnapshotMetadata(Y.mergeUpdates([head.data, state]))
          head.version += 1
        }, WORKER_LAG_MS)
      }
    })
    const lagging = new Hocuspocus({
      extensions: [laggingDatabase],
      debounce: 10_000,
      maxDebounce: 60_000
    })
    const laggingPrisma = createMockPrisma() as any
    laggingPrisma.documentMetadata.findUnique = async () => liveMeta(LAGGING_DOC, 'lagging-doc')
    laggingPrisma.documents.findFirst = headRowFrom(() => head)

    const applyContent = createApplyContent({
      hocuspocus: lagging,
      prisma: laggingPrisma,
      logger: silentLogger
    })
    const request = (text: string) => ({
      documentId: LAGGING_DOC,
      mode: 'replace' as const,
      content: bodyDoc(text),
      version: { trigger: 'api' as const, triggeredBy: null }
    })

    const first = await applyContent(request('first'))
    const second = await applyContent(request('second'))
    await new Promise((resolve) => setTimeout(resolve, WORKER_LAG_MS * 3))

    const { json } = decodeState(head.data)
    const texts = json.content.map((node) => node.content?.[0]?.text)
    expect(texts).toEqual(['Title', 'second'])
    // The transact and disconnect flushes both commit, so the head passes 2.
    expect(first).toEqual({ status: 'applied', version: expect.any(Number) })
    expect((first as { version: number }).version).toBeGreaterThan(1)
    expect(second.status).toBe('applied')
  })
})
