/**
 * Real-infra E2E for the document store pipeline:
 * BullMQ (real Redis) → worker → Prisma transaction (real Postgres) → Yjs round-trip.
 *
 * Run as a standalone process (NOT `bun test`): BullMQ's worker run-loop does not
 * progress under the bun test runner, but works in a normal process (as in prod).
 * Requires DATABASE_URL (test DB) + REDIS_HOST/REDIS_PORT + SUPABASE_URL/ANON (dummy ok).
 * Invoked by `make test-backend-e2e` and the backend-e2e CI job.
 */
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker, StoreDocumentQueue } from '../src/lib/queue'
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

await cleanup()
await worker.close()
await closeQueues()
await prisma.$disconnect()
await disconnectRedis()

console.log(failed ? '\nstore pipeline E2E: FAILED' : '\nstore pipeline E2E: PASSED')
process.exit(failed ? 1 : 0)
