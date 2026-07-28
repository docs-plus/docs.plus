import { beforeEach, describe, expect, test } from 'bun:test'
import { Database } from '@hocuspocus/extension-database'
import { Hocuspocus } from '@hocuspocus/server'
import { TiptapTransformer } from '@hocuspocus/transformer'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, TestServer } from '../../../../../tests/helpers/test-server'
import { migrationExtensions } from '../../../../lib/migration-extensions'
import { createInternalApp } from '../../http/internalApp'
import { createVersionOps } from '../../infra/versionOps'
import { MAX_VERSION_NUMBER } from '../../types'

const SERVICE_KEY = 'internal-versions-service-role-key'
const AUTH = { Authorization: `Bearer ${SERVICE_KEY}` }

const LIVE_DOC = 'liveVersionsDoc12AB'
const DRAFT_DOC = 'draftVersionsDoc1AB'
const REVERT_DOC = 'revertVersionsDocAB'
const INVALID_DOC = 'invalidTargetDocAB1'
const WEDGED_DOC = 'wedgedVersionsDocAB'
const MISSING_DOC = 'missingVersionsDocA'
const TOMBSTONED_DOC = 'tombstonedVersion1A'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const heading = (text: string) => ({
  type: 'heading',
  attrs: { level: 1 },
  content: [{ type: 'text', text }]
})

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

const snapshotBytes = (content: Record<string, unknown>[]): Buffer =>
  Buffer.from(
    Y.encodeStateAsUpdate(
      TiptapTransformer.toYdoc({ type: 'doc', content }, 'default', migrationExtensions)
    )
  )

/** Mirrors the production Database `fetch` default for a document with no rows. */
const draftDefaultState = (): Uint8Array => {
  const ydoc = new Y.Doc()
  const meta = ydoc.getMap('metadata')
  meta.set('needsInitialization', true)
  meta.set('isDraft', true)
  return Y.encodeStateAsUpdate(ydoc)
}

const persistedState = (content: Record<string, unknown>[]): Uint8Array => {
  const ydoc = TiptapTransformer.toYdoc({ type: 'doc', content }, 'default', migrationExtensions)
  ydoc.getMap('metadata').set('isDraft', false)
  return Y.encodeStateAsUpdate(ydoc)
}

const decodeText = (state: Uint8Array): string => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, state)
  return JSON.stringify(TiptapTransformer.fromYdoc(ydoc, 'default'))
}

interface StoreCall {
  documentName: string
  state: Uint8Array
  context: Record<string, unknown>
}

// One ordered log for both write kinds: the backup is a Prisma insert and the
// restore is a Database store, so separate counters could not prove the order
// the whole "a dead worker still leaves the pre-restore state" claim rests on.
const events: string[] = []
const stores: StoreCall[] = []
const persisted = new Map<string, Uint8Array>()
const rejecting = new Set<string>()

const database = new Database({
  fetch: async ({ documentName }) => persisted.get(documentName) ?? draftDefaultState(),
  store: async ({ documentName, state, context }) => {
    // The applier mutates this very object once transact resolves, so the
    // one-shot is only observable from a copy taken at store time.
    const snapshot = { ...(context as Record<string, unknown>) }
    stores.push({ documentName, state, context: snapshot })
    events.push(`store:${typeof snapshot.versionName === 'string' ? snapshot.versionName : '-'}`)
    if (rejecting.has(documentName)) throw new Error('forced store failure')
    persisted.set(documentName, state)
  }
})

// Production debounce values: `transact()` and `disconnect()` both store
// immediately, so nothing is left pending between tests.
const hocuspocus = new Hocuspocus({ extensions: [database], debounce: 10_000, maxDebounce: 60_000 })

const metaRows = new Map<string, Record<string, unknown> | null>()
const versionRows = new Map<string, { version: number; data: Buffer }>()
const heads = new Map<string, { version: number; data: Buffer }>()
const backupRows: Record<string, any>[] = []

const prisma = createMockPrisma() as any
prisma.documentMetadata.findUnique = async (args: any) =>
  metaRows.get(args.where.documentId) ?? null
prisma.documents.findFirst = async (args: any) =>
  versionRows.get(`${args.where.documentId}:${args.where.version}`) ?? null
// The head lock is the only raw query on this path; its single interpolation is
// the documentId.
prisma.$queryRaw = async (_strings: unknown, documentId: string) => {
  const head = heads.get(documentId)
  return head ? [head] : []
}
prisma.documents.create = async (args: any) => {
  backupRows.push(args.data)
  heads.set(args.data.documentId, { version: args.data.version, data: args.data.data })
  events.push(`backup:${args.data.version}`)
  return { version: args.data.version }
}

const ops = createVersionOps({
  hocuspocus,
  prisma,
  logger: silentLogger,
  // The real one lives in lib/queue, which boots BullMQ and Redis at import.
  stripSnapshotMetadata: (state) => {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, new Uint8Array(state))
    ydoc.getMap('metadata').delete('commitMessage')
    ydoc.getMap('metadata').delete('isDraft')
    return Buffer.from(Y.encodeStateAsUpdate(ydoc))
  }
})

const app = createInternalApp({
  verifyServiceRole: (header) => header === `Bearer ${SERVICE_KEY}`,
  ops
})
const server = new TestServer(app)

/** The shape the WS process takes when its service-role key is unset. */
const closedServer = new TestServer(createInternalApp({ verifyServiceRole: () => false, ops }))

const checkpointPath = (documentId: string) => `/internal/documents/${documentId}/versions`
const restorePath = (documentId: string, version: number | string) =>
  `/internal/documents/${documentId}/versions/${version}/restore`

const liveMeta = (documentId: string, slug: string) => ({
  documentId,
  slug,
  ownerId: 'owner-9',
  email: 'owner@example.com',
  deletedAt: null
})

const named = (name: string) => stores.filter((call) => call.context.versionName === name)

beforeEach(() => {
  events.length = 0
  stores.length = 0
  backupRows.length = 0
})

describe('Internal version ops — authorization', () => {
  beforeEach(() => {
    metaRows.set(LIVE_DOC, liveMeta(LIVE_DOC, 'live-versions'))
    persisted.set(LIVE_DOC, persistedState([heading('Live')]))
  })

  test('the checkpoint route rejects a missing bearer and writes nothing', async () => {
    const response = await server.post(checkpointPath(LIVE_DOC), { name: 'nope' })

    expect(response.status).toBe(401)
    expect(events).toHaveLength(0)
  })

  test('the checkpoint route rejects a wrong bearer', async () => {
    const response = await server.post(
      checkpointPath(LIVE_DOC),
      { name: 'nope' },
      { Authorization: 'Bearer nope' }
    )

    expect(response.status).toBe(401)
    expect(events).toHaveLength(0)
  })

  test('the restore route rejects a missing bearer and writes nothing', async () => {
    const response = await server.post(restorePath(LIVE_DOC, 1), {})

    expect(response.status).toBe(401)
    expect(events).toHaveLength(0)
  })

  test('the restore route rejects a wrong bearer', async () => {
    const response = await server.post(restorePath(LIVE_DOC, 1), {}, { Authorization: 'nope' })

    expect(response.status).toBe(401)
    expect(events).toHaveLength(0)
  })

  test('both routes reject a bare user JWT', async () => {
    const jwt = { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.user.jwt' }
    const checkpoint = await server.post(checkpointPath(LIVE_DOC), { name: 'nope' }, jwt)
    const restore = await server.post(restorePath(LIVE_DOC, 1), {}, jwt)

    expect([checkpoint.status, restore.status]).toEqual([401, 401])
    expect(events).toHaveLength(0)
  })

  test('both routes fail closed when the service-role key is unset', async () => {
    const checkpoint = await closedServer.post(checkpointPath(LIVE_DOC), { name: 'nope' }, AUTH)
    const restore = await closedServer.post(restorePath(LIVE_DOC, 1), {}, AUTH)

    expect([checkpoint.status, restore.status]).toEqual([401, 401])
    expect(events).toHaveLength(0)
  })

  test('an unknown internal path answers with the house 404 envelope', async () => {
    const response = await server.post('/internal/documents/nope/versions/x', {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('Internal version ops — existence and validation', () => {
  beforeEach(() => {
    metaRows.set(MISSING_DOC, null)
    metaRows.set(TOMBSTONED_DOC, {
      ...liveMeta(TOMBSTONED_DOC, 'gone'),
      deletedAt: new Date()
    })
    metaRows.set(LIVE_DOC, liveMeta(LIVE_DOC, 'live-versions'))
  })

  test('a checkpoint on a document with no metadata row 404s', async () => {
    const response = await server.post(checkpointPath(MISSING_DOC), { name: 'nope' }, AUTH)

    expect(response.status).toBe(404)
    expect(events).toHaveLength(0)
  })

  test('a checkpoint on a tombstoned document 404s', async () => {
    const response = await server.post(checkpointPath(TOMBSTONED_DOC), { name: 'nope' }, AUTH)

    expect(response.status).toBe(404)
    expect(events).toHaveLength(0)
  })

  test('a restore on a tombstoned document 404s before it reads the target row', async () => {
    const response = await server.post(restorePath(TOMBSTONED_DOC, 1), {}, AUTH)

    expect(response.status).toBe(404)
    expect(events).toHaveLength(0)
  })

  test('a restore of a version the document does not have 404s', async () => {
    const response = await server.post(restorePath(LIVE_DOC, 99), {}, AUTH)

    expect(response.status).toBe(404)
    expect(events).toHaveLength(0)
  })

  test('a blank checkpoint name is a 400', async () => {
    const response = await server.post(checkpointPath(LIVE_DOC), { name: '  ' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR')
    expect(events).toHaveLength(0)
  })

  test('a restore version past the int4 ceiling is a 400', async () => {
    const response = await server.post(restorePath(LIVE_DOC, MAX_VERSION_NUMBER + 1), {}, AUTH)

    expect(response.status).toBe(400)
    expect(events).toHaveLength(0)
  })
})

describe('Internal version ops — checkpoint', () => {
  beforeEach(() => {
    metaRows.set(LIVE_DOC, liveMeta(LIVE_DOC, 'live-versions'))
    persisted.set(LIVE_DOC, persistedState([heading('Live')]))
  })

  test('a live document mints exactly one store carrying the checkpoint name', async () => {
    const response = await server.post(checkpointPath(LIVE_DOC), { name: 'Release cut' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: LIVE_DOC, name: 'Release cut' })
    expect(named('Release cut')).toHaveLength(1)
    expect(named('Release cut')[0].context).toMatchObject({
      versionTrigger: 'checkpoint',
      versionTriggeredBy: null,
      slug: 'live-versions',
      documentId: LIVE_DOC,
      deviceType: 'service'
    })
  })

  test('the flush after the checkpoint keeps the force key and drops only the name', async () => {
    await server.post(checkpointPath(LIVE_DOC), { name: 'Kept key' }, AUTH)

    const stamped = named('Kept key')[0].context
    const flush = stores[stores.length - 1].context

    expect(stores.length).toBeGreaterThan(1)
    expect('versionName' in flush).toBe(false)
    expect('versionTrigger' in flush).toBe(false)
    // Present-but-null, so the flush credits nobody instead of the owner the
    // direct connection carries as `user`.
    expect('versionTriggeredBy' in flush).toBe(true)
    expect(flush.versionTriggeredBy).toBeNull()
    // Kept, so the flush re-derives the SAME widened job id and dedupes rather
    // than minting a duplicate row.
    expect(flush.versionForceKey).toBe(stamped.versionForceKey as string)
    expect(typeof flush.versionForceKey).toBe('string')
  })

  test('a draft document is refused and no store carries the checkpoint stamp', async () => {
    metaRows.set(DRAFT_DOC, liveMeta(DRAFT_DOC, 'draft-versions'))
    persisted.delete(DRAFT_DOC)

    const response = await server.post(checkpointPath(DRAFT_DOC), { name: 'nope' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toHaveProperty('code', 'DRAFT_DOCUMENT')
    // The release disconnect still flushes the untouched draft here; production's
    // store() drops it on the isDraft guard. What must never happen is a stamped
    // store, because commit() is the only thing that names a row.
    expect(stores.every((call) => call.context.versionName === undefined)).toBe(true)
    expect(stores.every((call) => call.context.versionTrigger === undefined)).toBe(true)
    expect(backupRows).toHaveLength(0)
  })
})

describe('Internal version ops — restore', () => {
  beforeEach(() => {
    metaRows.set(REVERT_DOC, liveMeta(REVERT_DOC, 'revert-versions'))
    persisted.set(REVERT_DOC, persistedState([heading('Head'), paragraph('unsaved')]))
    heads.set(REVERT_DOC, { version: 2, data: snapshotBytes([heading('Head')]) })
    versionRows.set(`${REVERT_DOC}:2`, {
      version: 2,
      data: snapshotBytes([heading('Target'), paragraph('older body')])
    })
  })

  test('the pre-restore backup is committed before the restore store', async () => {
    const response = await server.post(restorePath(REVERT_DOC, 2), {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: REVERT_DOC, restoredFrom: 2, backupVersion: 3 })

    const backupAt = events.indexOf('backup:3')
    const restoreAt = events.indexOf('store:Restored version 2')
    expect(backupAt).toBeGreaterThanOrEqual(0)
    expect(restoreAt).toBeGreaterThanOrEqual(0)
    expect(backupAt).toBeLessThan(restoreAt)
  })

  test('the backup row names the restore it precedes and is not a user checkpoint', async () => {
    await server.post(restorePath(REVERT_DOC, 2), {}, AUTH)

    expect(backupRows).toHaveLength(1)
    expect(backupRows[0]).toMatchObject({
      documentId: REVERT_DOC,
      version: 3,
      commitMessage: 'Before restore of version 2',
      trigger: 'revert-backup',
      triggeredBy: null,
      contributors: []
    })
  })

  test('the live document ends up holding the target version content', async () => {
    await server.post(restorePath(REVERT_DOC, 2), {}, AUTH)

    const text = decodeText(persisted.get(REVERT_DOC) as Uint8Array)
    expect(text).toContain('Target')
    expect(text).not.toContain('unsaved')
  })

  test('a target the current schema cannot express is a 422 with zero writes', async () => {
    metaRows.set(INVALID_DOC, liveMeta(INVALID_DOC, 'invalid-target'))
    versionRows.set(`${INVALID_DOC}:1`, {
      version: 1,
      data: snapshotBytes([paragraph('no title heading')])
    })

    const response = await server.post(restorePath(INVALID_DOC, 1), {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toHaveProperty('code', 'UNPROCESSABLE_ENTITY')
    expect(body.error.message).toContain('level-1 heading')
    expect(events).toHaveLength(0)
    expect(backupRows).toHaveLength(0)
  })

  test('undecodable target bytes are a 422 with zero writes', async () => {
    metaRows.set(INVALID_DOC, liveMeta(INVALID_DOC, 'invalid-target'))
    versionRows.set(`${INVALID_DOC}:2`, { version: 2, data: Buffer.from([9, 9, 9, 9]) })

    const response = await server.post(restorePath(INVALID_DOC, 2), {}, AUTH)

    expect(response.status).toBe(422)
    expect(events).toHaveLength(0)
    expect(backupRows).toHaveLength(0)
  })
})

describe('Internal version ops — wedged persistence', () => {
  test('a rejecting store yields the crafted 500 twice and still lands the backup', async () => {
    metaRows.set(WEDGED_DOC, liveMeta(WEDGED_DOC, 'wedged-versions'))
    persisted.set(WEDGED_DOC, persistedState([heading('Head')]))
    heads.set(WEDGED_DOC, { version: 1, data: snapshotBytes([heading('Head')]) })
    versionRows.set(`${WEDGED_DOC}:1`, { version: 1, data: snapshotBytes([heading('Target')]) })
    rejecting.add(WEDGED_DOC)

    const first = await server.post(restorePath(WEDGED_DOC, 1), {}, AUTH)
    const firstBody = await first.json()

    expect(first.status).toBe(500)
    expect(firstBody.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(firstBody.error.message).toContain('wedged')
    expect(backupRows[0]).toMatchObject({
      version: 2,
      commitMessage: 'Before restore of version 1'
    })

    // Stop the store rejecting first. The debouncer never cleared the failed
    // execution, so the document stays wedged on its own — leaving the store
    // rejecting would let a healthy server pass this too.
    rejecting.delete(WEDGED_DOC)
    const storesBefore = stores.length

    const second = await server.post(restorePath(WEDGED_DOC, 1), {}, AUTH)
    const secondBody = await second.json()

    expect(second.status).toBe(500)
    expect(secondBody.error.message).toContain('wedged')
    // The Database hook is never reached again — that is the wedge. The second
    // call still writes its own backup, which runs before the restore attempt.
    expect(stores.length).toBe(storesBefore)
    expect(backupRows).toHaveLength(2)
  })
})
