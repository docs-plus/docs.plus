import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { EnqueueStoreDocumentParams } from '../../src/lib/queue'
import type { StoreDocumentContext } from '../../src/types'

// The real queue module opens a Redis connection at import (and throws without
// one), so the store hook's collaborators are stubbed. The stub job id stays a
// pure function of the bytes, which is all the dedupe assertions rely on.
const enqueued: EnqueueStoreDocumentParams[] = []
const jobIdFor = (documentName: string, state: Uint8Array) =>
  `doc-${documentName.replaceAll(':', '_')}-${state.byteLength}-${Bun.hash(state).toString(36)}`

// Armed by the wedge test to drive the store hook down its fallback path and
// then out the far side; null everywhere else so the other suites see a queue
// and a database that behave.
let enqueueFailure: Error | null = null
let transactionFailure: Error | null = null

// `mock.module` is process-global and outlives this file, so every remaining
// export is stubbed to throw by name. Omitting them hands a later-loaded suite
// `undefined` and a "not a function" thrown nowhere near the cause.
const notStubbed =
  (name: string, module = 'queue') =>
  () => {
    throw new Error(
      `src/lib/${module}.${name} is mocked out by tests/unit/hocuspocusConfig.test.ts`
    )
  }

// The Prisma client is a Proxy, so spyOn cannot reach $transaction — the module
// is replaced instead. Only the store hook's fallback path uses it here.
mock.module('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: async () => {
      if (transactionFailure) throw transactionFailure
      throw new Error('prisma.$transaction is mocked out by tests/unit/hocuspocusConfig.test.ts')
    }
  },
  checkDatabaseHealth: notStubbed('checkDatabaseHealth', 'prisma'),
  shutdownDatabase: notStubbed('shutdownDatabase', 'prisma')
}))

mock.module('../../src/lib/queue', () => ({
  buildStoreJobId: jobIdFor,
  enqueueStoreDocument: async (params: EnqueueStoreDocumentParams) => {
    if (enqueueFailure) throw enqueueFailure
    enqueued.push(params)
  },
  stripSnapshotMetadata: (state: Uint8Array) => Buffer.from(state),
  DeadLetterQueue: notStubbed('DeadLetterQueue'),
  StoreDocumentQueue: notStubbed('StoreDocumentQueue'),
  closeQueues: notStubbed('closeQueues'),
  createDocumentWorker: notStubbed('createDocumentWorker'),
  getStoreQueueOldestWaitingAgeMs: notStubbed('getStoreQueueOldestWaitingAgeMs'),
  refreshPendingStateKeyTtls: notStubbed('refreshPendingStateKeyTtls')
}))

import { Database } from '@hocuspocus/extension-database'
import * as Y from 'yjs'

import { recordContributor } from '../../src/lib/contributors'
import { documentStoreRejectionsTotal } from '../../src/lib/metrics'
import HocuspocusConfig from '../../src/config/hocuspocus.config'

const DOCUMENT_NAME = 'aB3dEfGhIjKlMnOpQrS'
const BYTES = Buffer.from([1, 2, 3, 4])
const OTHER_BYTES = Buffer.from([9, 8, 7, 6, 5])

const database = HocuspocusConfig().extensions.find((extension: unknown) => {
  return extension instanceof Database
}) as { configuration: { store: (data: unknown) => Promise<void> } }

const liveDoc = (metadata: Record<string, unknown> = {}) => {
  const document = new Y.Doc()
  const meta = document.getMap('metadata')
  for (const [key, value] of Object.entries(metadata)) meta.set(key, value)
  return document
}

const store = (document: Y.Doc, context: StoreDocumentContext, state: Buffer = BYTES) =>
  database.configuration.store({ documentName: DOCUMENT_NAME, state, context, document })

beforeEach(() => {
  enqueued.length = 0
  enqueueFailure = null
  transactionFailure = null
})

const rejectionsFor = async (reason: string): Promise<number> => {
  const { values } = await documentStoreRejectionsTotal.get()
  return values.find((entry) => entry.labels.reason === reason)?.value ?? 0
}

describe('store hook — version name', () => {
  test('a context name wins and never touches the live metadata map', async () => {
    const document = liveDoc({ commitMessage: 'from the map' })

    await store(document, { versionName: 'Before restore of version 3' })

    expect(enqueued[0]?.commitMessage).toBe('Before restore of version 3')
    expect(document.getMap('metadata').get('commitMessage')).toBe('from the map')
  })

  test('the metadata label is used and consumed when the context carries no name', async () => {
    const document = liveDoc({ commitMessage: 'Restored version 3' })

    await store(document, { user: { sub: 'owner-1' } })

    expect(enqueued[0]?.commitMessage).toBe('Restored version 3')
    expect(document.getMap('metadata').get('commitMessage')).toBeUndefined()
  })
})

describe('store hook — attribution', () => {
  test('a live save defaults to websocket and credits the connected user', async () => {
    await store(liveDoc(), { user: { sub: 'owner-1' } })

    expect(enqueued[0]?.trigger).toBe('websocket')
    expect(enqueued[0]?.triggeredBy).toBe('owner-1')
  })

  test('an explicit null triggeredBy is not re-derived from the connection user', async () => {
    await store(liveDoc(), { user: { sub: 'owner-1' }, versionTriggeredBy: null })

    expect(enqueued[0]?.triggeredBy).toBeNull()
  })

  test('contributors recorded since the previous save ride the job once', async () => {
    const document = liveDoc()
    recordContributor(document, { user: { sub: 'alice' } })
    recordContributor(document, { user: { sub: 'bob' } })

    await store(document, { user: { sub: 'alice' } })
    await store(document, { user: { sub: 'alice' } }, OTHER_BYTES)

    expect(enqueued[0]?.contributors).toEqual(['alice', 'bob'])
    expect(enqueued[1]?.contributors).toEqual([])
  })
})

describe('store hook — job id', () => {
  test('a force key suffixes the job id and keeps it colon-free', async () => {
    await store(liveDoc(), { versionForceKey: 'k1a2b3' })

    expect(enqueued[0]?.jobId).toBe(`${jobIdFor(DOCUMENT_NAME, BYTES)}-k1a2b3`)
    expect(enqueued[0]?.jobId).not.toContain(':')
  })

  test('the same context and bytes dedupe, and the kept force key survives the one-shot', async () => {
    const context: StoreDocumentContext = {
      user: { sub: 'owner-1' },
      versionName: 'Checkpoint',
      versionTrigger: 'checkpoint',
      versionTriggeredBy: 'actor-9',
      versionForceKey: 'k1a2b3'
    }

    await store(liveDoc(), context)
    await store(liveDoc(), context)
    expect(enqueued[1]?.jobId).toBe(enqueued[0]!.jobId)

    // What the applier leaves behind once the checkpoint transaction resolves:
    // name and trigger absent, triggeredBy present-but-null, force key kept.
    delete context.versionName
    delete context.versionTrigger
    context.versionTriggeredBy = null
    await store(liveDoc(), context, OTHER_BYTES)

    const flush = enqueued[2]!
    expect(flush.commitMessage).toBe('')
    expect(flush.trigger).toBe('websocket')
    expect(flush.triggeredBy).toBeNull()
    expect(flush.jobId).not.toBe(enqueued[0]!.jobId)
    expect(flush.jobId).toBe(`${jobIdFor(DOCUMENT_NAME, OTHER_BYTES)}-k1a2b3`)
    expect(flush.jobId).not.toBe(jobIdFor(DOCUMENT_NAME, OTHER_BYTES))
  })
})

describe('store hook — a failed save must not wedge the debouncer', () => {
  test('a dead queue plus a dead database still resolves, and the next save lands', async () => {
    const before = await rejectionsFor('fallback-save-failed')
    enqueueFailure = new Error('queue unavailable')
    transactionFailure = new Error('database unavailable')

    // Hocuspocus caches the store promise per document and never clears a
    // rejected one, so throwing here would stop this room saving — and unloading
    // — for the process lifetime.
    expect(await store(liveDoc(), {})).toBeUndefined()
    expect(await rejectionsFor('fallback-save-failed')).toBe(before + 1)

    enqueueFailure = null
    transactionFailure = null
    await store(liveDoc(), {}, OTHER_BYTES)

    expect(enqueued).toHaveLength(1)
    expect(enqueued[0]?.jobId).toBe(jobIdFor(DOCUMENT_NAME, OTHER_BYTES))
  })
})
