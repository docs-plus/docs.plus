/**
 * Real-infra E2E for the document store pipeline:
 * BullMQ (real Redis) → worker → Prisma transaction (real Postgres) → Yjs round-trip.
 *
 * Run as a standalone process, NOT `bun test`. BullMQ's worker run-loop does not
 * progress under the bun test runner. It works in a normal process, as in prod.
 * Requires DATABASE_URL (test DB) + REDIS_HOST/REDIS_PORT + SUPABASE_URL/ANON (dummy ok).
 * Invoked by `make test-backend-e2e` and the backend-e2e CI job.
 */
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import {
  buildStoreJobId,
  closeQueues,
  createDocumentWorker,
  DeadLetterQueue,
  drainStoreDeadLetterQueue,
  enqueueStoreDocument,
  StoreDocumentQueue
} from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'

const PREFIX = `e2e-store-${Date.now()}`
let failed = false

function check(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failed = true
}

function yjsStateBase64(text: string): string {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, text)
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')
}

async function waitForVersion(documentId: string, version: number, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const row = await prisma.documents.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' }
    })
    if (row && row.version >= version) return row
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

async function cleanup() {
  await prisma.documents.deleteMany({ where: { documentId: { startsWith: PREFIX } } })
  await prisma.documentMetadata.deleteMany({ where: { documentId: { startsWith: PREFIX } } })
}

console.log('E2E: store pipeline (real Redis + Postgres + BullMQ + Yjs)')
await cleanup()
const worker = createDocumentWorker()
await StoreDocumentQueue.waitUntilReady()
await worker.waitUntilReady()

// 1. A queued document is persisted at version 1, Yjs round-trips, metadata created.
const doc1 = `${PREFIX}-doc1`
await StoreDocumentQueue.add('store-document', {
  documentName: doc1,
  state: yjsStateBase64('hello e2e'),
  context: { slug: doc1 },
  commitMessage: 'e2e-1'
})
const row1 = await waitForVersion(doc1, 1)
check(!!row1 && row1.version === 1, 'document persisted at version 1')
if (row1) {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, new Uint8Array(row1.data))
  check(ydoc.getText('content').toString() === 'hello e2e', 'Yjs state round-trips through the DB')
}
check(
  !!(await prisma.documentMetadata.findUnique({ where: { documentId: doc1 } })),
  'metadata row created on first save'
)

// 2. A second save increments the version (real FOR UPDATE transaction).
const doc2 = `${PREFIX}-doc2`
await StoreDocumentQueue.add('store-document', {
  documentName: doc2,
  state: yjsStateBase64('first'),
  context: { slug: doc2 },
  commitMessage: 'e2e-2a'
})
await waitForVersion(doc2, 1)
await StoreDocumentQueue.add('store-document', {
  documentName: doc2,
  state: yjsStateBase64('second'),
  context: { slug: doc2 },
  commitMessage: 'e2e-2b'
})
const row2 = await waitForVersion(doc2, 2)
check(!!row2 && row2.version === 2, 'second save increments to version 2')

// 3. Claim-check enqueue (the WS store-hook path): state rides a TTL'd Redis
// key, and the job carries only the reference. The worker strips the transient
// metadata keys from the stored snapshot.
const doc3 = `${PREFIX}-doc3`
const ydoc3 = new Y.Doc()
ydoc3.getText('content').insert(0, 'claim check')
ydoc3.getMap('metadata').set('commitMessage', 'e2e-3')
const state3 = Buffer.from(Y.encodeStateAsUpdate(ydoc3))
// The production builder, not a hand-rolled id: BullMQ rejects colon-bearing
// custom jobIds, and a stand-in format is exactly how that slipped through.
await enqueueStoreDocument({
  jobId: buildStoreJobId(doc3, state3),
  documentName: doc3,
  state: state3,
  context: { slug: doc3 },
  commitMessage: 'e2e-3'
})
const row3 = await waitForVersion(doc3, 1)
check(!!row3 && row3.version === 1, 'claim-check job persisted at version 1')
if (row3) {
  const restored = new Y.Doc()
  Y.applyUpdate(restored, new Uint8Array(row3.data))
  check(
    restored.getText('content').toString() === 'claim check',
    'claim-check state round-trips through Redis key + DB'
  )
  check(
    !restored.getMap('metadata').has('commitMessage'),
    'worker strips commitMessage from the stored snapshot'
  )
  check(row3.commitMessage === 'e2e-3', 'commitMessage rides the version row')
}

// 4. DLQ drain: a dead-lettered payload replays through the SAME worker merge, so
// the restored version unions with the locked head instead of replacing it. Every
// drain below names its own document — the operator's unfiltered drain would eat a
// developer's real stranded saves, so no test may call it.
const doc4 = `${PREFIX}-doc4`
const headDoc = new Y.Doc()
headDoc.getText('content').insert(0, 'head-A')
const headState = Buffer.from(Y.encodeStateAsUpdate(headDoc))
await enqueueStoreDocument({
  jobId: buildStoreJobId(doc4, headState),
  documentName: doc4,
  state: headState,
  context: { slug: doc4 },
  commitMessage: 'e2e-4-head'
})
await waitForVersion(doc4, 1)

// A second client's edit, dead-lettered raw exactly as the worker embeds it.
const stranded = new Y.Doc()
stranded.getText('stranded').insert(0, 'stranded-B')
stranded.getMap('metadata').set('commitMessage', 'e2e-4')
await DeadLetterQueue.add('failed-document', {
  documentName: doc4,
  state: Buffer.from(Y.encodeStateAsUpdate(stranded)).toString('base64'),
  context: { slug: doc4 },
  commitMessage: 'e2e-4',
  failureReason: 'e2e synthetic',
  failedAt: new Date().toISOString()
})

const drained = await drainStoreDeadLetterQueue({ apply: true, documentId: doc4 })
// Vacuous on CI's empty REDIS_DB=15, load-bearing on a developer's dirty DLQ:
// this is what says the pass left their stranded entries alone.
check(
  drained.entries.every((e) => e.documentName === doc4),
  'drain considered only the filtered document'
)
check(
  drained.entries.some((e) => e.documentName === doc4 && e.disposition === 'replay'),
  'drain marks the dead-lettered entry replayable'
)
check(
  drained.entries.some((e) => e.documentName === doc4 && e.headVersion === 1),
  'drain reports the head version the replay will merge onto'
)
const row4 = await waitForVersion(doc4, 2)
check(!!row4, 'replayed payload lands as a new version')
if (row4) {
  const merged = new Y.Doc()
  Y.applyUpdate(merged, new Uint8Array(row4.data))
  // A plain insert of the stranded state alone would lose 'head-A'. This is the
  // assertion that pins "replayed through the merge path".
  check(
    merged.getText('content').toString() === 'head-A' &&
      merged.getText('stranded').toString() === 'stranded-B',
    'replay merged with the locked head instead of replacing it'
  )
  check(
    !merged.getMap('metadata').has('commitMessage'),
    'replay went through the real worker strip'
  )
}
const after = await drainStoreDeadLetterQueue({ apply: false, documentId: doc4 })
check(after.entries.length === 0, 'drained entry is removed from the DLQ')

await cleanup()
await worker.close()
await closeQueues()
await prisma.$disconnect()
await disconnectRedis()

console.log(failed ? '\nstore pipeline E2E: FAILED' : '\nstore pipeline E2E: PASSED')
process.exit(failed ? 1 : 0)
