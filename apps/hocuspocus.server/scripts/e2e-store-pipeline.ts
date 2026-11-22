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

import { lockDocumentStore } from '../src/lib/lockDocumentStore'
import { documentStoreOutcomeTotal, jobsTotal } from '../src/lib/metrics'
import { persistSnapshot } from '../src/lib/persistSnapshot'
import { prisma } from '../src/lib/prisma'
import {
  buildStoreJobId,
  closeQueues,
  createDocumentWorker,
  DeadLetterQueue,
  drainStoreDeadLetterQueue,
  enqueueStoreDocument,
  refreshPendingStateKeyTtls,
  StoreDocumentQueue
} from '../src/lib/queue'
import { createRedisConnection, disconnectRedis } from '../src/lib/redis'
import { createTally, pollFor } from './lib/e2eHarness'

const PREFIX = `e2e-store-${Date.now()}`
const { check, outcome } = createTally()

// queue.ts keeps its state client private, so the claim-check keys are read here.
const stateRedis = createRedisConnection()
if (!stateRedis) throw new Error('store pipeline E2E needs REDIS_HOST/REDIS_PORT')

function yjsStateBase64(text: string): string {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, text)
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')
}

const waitForVersion = (documentId: string, version: number) =>
  pollFor(
    () => prisma.documents.findFirst({ where: { documentId }, orderBy: { version: 'desc' } }),
    (row) => row.version >= version
  )

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

// 5. Worker exhaust: the final attempt dead-letters the inline payload and drops
// the claim-check key. 0x80 is a cut-off varint, so the strip always throws.
// Random bytes can decode cleanly and save instead. All 5 attempts, as in production.
const doc5 = `${PREFIX}-doc5`
const poison = Buffer.from([0x80])
const jobId5 = buildStoreJobId(doc5, poison)
const stateKey5 = `store-doc-state:${jobId5}`
const storeJobs = async (status: string) =>
  (await jobsTotal.get()).values.find(
    (v) => v.labels.queue === 'store-documents' && v.labels.status === status
  )?.value ?? 0
const failedBefore5 = await storeJobs('failed')
const retriedBefore5 = await storeJobs('retried')
await stateRedis.set(stateKey5, poison, 'EX', 3600)
await StoreDocumentQueue.add(
  'store-document',
  { documentName: doc5, stateKey: stateKey5, context: { slug: doc5 } },
  { jobId: jobId5, attempts: 5, backoff: { type: 'fixed', delay: 100 } }
)
const readEntries5 = async () =>
  (await DeadLetterQueue.getJobs(['waiting', 'delayed', 'prioritized'])).filter(
    (job) => job.data.documentName === doc5
  )
// This poll only proves an entry appeared. The count waits for the job to fail.
const firstEntries5 = await pollFor(readEntries5, (entries) => entries.length > 0, 15_000)
check((firstEntries5?.length ?? 0) > 0, 'exhausted job writes a DLQ entry')
// The worker's DEL is fire-and-forget, so give it a moment to land.
const keyCount5 = await pollFor(
  () => stateRedis.exists(stateKey5),
  (n) => n === 0,
  5000
)
check(keyCount5 === 0, 'dead-letter deletes the claim-check key')
// The DLQ add runs before the re-throw, so the job is still locked at first sight.
const jobState5 = await pollFor(
  async () => (await StoreDocumentQueue.getJob(jobId5))?.getState(),
  (state) => state === 'failed',
  15_000
)
check(jobState5 === 'failed', 'main-queue job ends failed after its five attempts')
// #726: only the last attempt is `failed`, so one lost save pages once. The 'failed'
// event lands after the state change, so poll the counter.
const failed5 = await pollFor(
  async () => (await storeJobs('failed')) - failedBefore5,
  (n) => n >= 1,
  5000
)
check(failed5 === 1, `exhausted job counts one failed attempt (${failed5})`)
const retried5 = (await storeJobs('retried')) - retriedBefore5
check(retried5 === 4, `exhausted job counts four retried attempts (${retried5})`)
// Count only now: a broken guard that dead-letters attempt 1 adds a second,
// payload-less entry on attempt 2, and every DLQ add lands before 'failed'.
const entries5 = await readEntries5()
check(entries5.length === 1, 'exhausted job writes exactly one DLQ entry')
const entry5 = entries5[0]
if (entry5) {
  check(
    !!entry5.data.state && Buffer.from(entry5.data.state, 'base64').equals(poison),
    'DLQ entry embeds the claim-check state inline as base64'
  )
  check(entry5.data.originalJobId === jobId5, 'DLQ entry names the original job id')
}
await Promise.all(entries5.map((job) => job.remove()))
if (jobState5 === 'failed') await (await StoreDocumentQueue.getJob(jobId5))?.remove()
await stateRedis.del(stateKey5)

// 7-10 (#704) read the claim-check keys, the rows and the store outcome counter.
const stateKeyOf = (jobId: string) => `store-doc-state:${jobId}`
const jobStateIs = (jobId: string, state: string) =>
  pollFor(
    () => StoreDocumentQueue.getJobState(jobId),
    (s) => s === state,
    15_000
  )
const rowCount = (documentId: string) => prisma.documents.count({ where: { documentId } })
const outcomeCount = async (outcome: string) =>
  (await documentStoreOutcomeTotal.get()).values.find((v) => v.labels.outcome === outcome)?.value ??
  0
// buildStoreJobId reads the clock; a fixed instant picks the 10 s window.
const jobIdAt = (documentName: string, state: Uint8Array, at: number) => {
  const now = Date.now
  Date.now = () => at
  try {
    return buildStoreJobId(documentName, state)
  } finally {
    Date.now = now
  }
}
const enqueueAt = (
  documentName: string,
  state: Buffer,
  at: number,
  contributors: string[] = []
) => {
  const jobId = jobIdAt(documentName, state, at)
  return enqueueStoreDocument({
    jobId,
    documentName,
    state,
    context: { slug: documentName },
    commitMessage: '',
    trigger: 'websocket',
    triggeredBy: null,
    contributors
  }).then(() => jobId)
}
// Two rows written straight through persistSnapshot, so the head is not the first row.
const seedRoom = async (documentName: string) => {
  await prisma.documentMetadata.create({
    data: { documentId: documentName, slug: documentName, title: 'e2e' }
  })
  const doc = new Y.Doc()
  doc.getText('content').insert(0, 'seed')
  for (const _ of [1, 2]) {
    doc.getText('content').insert(0, '>')
    await persistSnapshot(prisma, {
      documentId: documentName,
      incoming: Y.encodeStateAsUpdate(doc),
      commitMessage: '',
      trigger: 'websocket',
      triggeredBy: null,
      contributors: [],
      forced: false,
      skipUnchanged: true
    })
  }
  return doc
}
const stateOf = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc))
const windowStart = Math.floor(Date.now() / 10_000) * 10_000

// 7. A save whose job already completed writes no claim-check key (#704). BullMQ drops the
// add as a duplicate, so before the fix nothing ever deleted that key.
{
  const doc7 = `${PREFIX}-doc7`
  const doc = await seedRoom(doc7)
  doc.getText('content').insert(0, 'seven ')
  const at = windowStart + 1000
  const jobId = await enqueueAt(doc7, stateOf(doc), at)
  check((await jobStateIs(jobId, 'completed')) === 'completed', 'section 7 job completed')
  const again = await enqueueAt(doc7, stateOf(doc), at + 2000)
  check(again === jobId, 'section 7 second save lands on the same job id')
  check((await stateRedis.exists(stateKeyOf(jobId))) === 0, 'a deduped save leaves no orphan key')
  check((await rowCount(doc7)) === 3, 'the deduped save adds no row')
}

// 8. A live job keeps the SET: with the queue paused, the second enqueue of the same id
// must leave its key, or the job would run with no payload.
{
  const doc8 = `${PREFIX}-doc8`
  const doc = await seedRoom(doc8)
  doc.getText('content').insert(0, 'eight ')
  await StoreDocumentQueue.pause()
  let keyPresent = 0
  let jobId = ''
  try {
    jobId = await enqueueAt(doc8, stateOf(doc), windowStart + 1000)
    await enqueueAt(doc8, stateOf(doc), windowStart + 3000)
    keyPresent = await stateRedis.exists(stateKeyOf(jobId))
  } finally {
    await StoreDocumentQueue.resume()
  }
  check(keyPresent === 1, 'a duplicate enqueue of a waiting job keeps its key')
  check((await jobStateIs(jobId, 'completed')) === 'completed', 'section 8 job completed')
  check((await rowCount(doc8)) === 3, 'the waiting job wrote its row after resume')
}

// 9. Twin flushes of one write, 3 s, 8 s and 12 s apart, give one row. The 3 s pair
// shares a 10 s window and dedupes on the job id. The others become a second job that
// the skip rule keeps on the head.
for (const gapMs of [3000, 8000, 12_000]) {
  const doc9 = `${PREFIX}-doc9-${gapMs}`
  const doc = await seedRoom(doc9)
  doc.getText('content').insert(0, 'twin ')
  const at = windowStart + 5000
  const first = await enqueueAt(doc9, stateOf(doc), at, ['alice'])
  await jobStateIs(first, 'completed')
  const twin = await enqueueAt(doc9, stateOf(doc), at + gapMs, ['bob'])
  const twinDone = await jobStateIs(twin, 'completed')
  const head = await prisma.documents.findFirst({
    where: { documentId: doc9 },
    orderBy: { version: 'desc' }
  })
  check(
    twinDone === 'completed' && (await rowCount(doc9)) === 3,
    `twin flushes ${gapMs / 1000} s apart give one row (rows ${await rowCount(doc9)})`
  )
  // A pair inside one window is one job, so only the second editor of a two-job pair counts.
  if (gapMs >= 5000) {
    check(
      JSON.stringify(head?.contributors) === '["alice","bob"]',
      `twin flushes ${gapMs / 1000} s apart keep both contributors (${head?.contributors})`
    )
  }
  check(
    (await stateRedis.exists(stateKeyOf(first), stateKeyOf(twin))) === 0,
    `twin flushes ${gapMs / 1000} s apart leave no claim-check key`
  )
}

// 10. The two ways concurrent jobs reach one document (#704). A held room's write returns
// before its job commits, so the next write's job runs beside it. And the second store of
// one write can fall into the next 10 s window, a second job with the same bytes. A second
// worker stands in for the second replica. A holder keeps the store busy until both
// jobs wait, so the overlap does not depend on timing.
const worker2 = createDocumentWorker()
await worker2.waitUntilReady()
let failedAttempts = 0
const countFailed = () => {
  failedAttempts += 1
}
worker.on('failed', countFailed)
worker2.on('failed', countFailed)

const overlap = async (documentName: string, enqueue: () => Promise<string[]>) => {
  await StoreDocumentQueue.pause()
  let jobIds: string[] = []
  try {
    jobIds = await enqueue()
  } catch (err) {
    await StoreDocumentQueue.resume()
    throw err
  }
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  let held!: () => void
  const ready = new Promise<void>((resolve) => (held = resolve))
  const holder = prisma.$transaction(
    async (tx) => {
      await lockDocumentStore(tx, documentName)
      await tx.$queryRaw`
        SELECT id FROM "Documents" WHERE "documentId" = ${documentName}
        ORDER BY version DESC LIMIT 1 FOR UPDATE`
      held()
      await released
    },
    { timeout: 30_000 }
  )
  await ready
  await StoreDocumentQueue.resume()
  const active = await pollFor(
    async () => (await StoreDocumentQueue.getJobCounts('active')).active,
    (n) => n >= 2,
    10_000
  )
  release()
  await holder
  const states = await Promise.all(jobIds.map((id) => jobStateIs(id, 'completed')))
  return { active, done: states.every((state) => state === 'completed') }
}

{
  const doc10a = `${PREFIX}-doc10a`
  const doc = await seedRoom(doc10a)
  const failedBefore = failedAttempts
  // Two editors that have not seen each other's write, so neither job can keep the head.
  const other = new Y.Doc()
  Y.applyUpdate(other, Y.encodeStateAsUpdate(doc))
  doc.getText('content').insert(0, 'first ')
  other.getText('other').insert(0, 'second')
  const ran = await overlap(doc10a, async () => [
    await enqueueAt(doc10a, stateOf(doc), windowStart + 1000),
    await enqueueAt(doc10a, stateOf(other), windowStart + 1000)
  ])
  const head = await prisma.documents.findFirst({
    where: { documentId: doc10a },
    orderBy: { version: 'desc' }
  })
  const text = new Y.Doc()
  if (head) Y.applyUpdate(text, new Uint8Array(head.data))
  check((ran.active ?? 0) >= 2, `held-room writes: both jobs ran at once (${ran.active} active)`)
  check(
    ran.done && failedAttempts === failedBefore,
    `held-room writes: no failed attempt (${failedAttempts - failedBefore})`
  )
  check((await rowCount(doc10a)) === 4, 'held-room writes: both rows landed')
  check(
    text.getText('content').toString() === 'first >>seed' &&
      text.getText('other').toString() === 'second',
    'held-room writes: the head holds both writes'
  )
}

{
  const doc10b = `${PREFIX}-doc10b`
  const doc = await seedRoom(doc10b)
  doc.getText('content').insert(0, 'one write ')
  const failedBefore = failedAttempts
  const unchangedBefore = await outcomeCount('unchanged')
  const ran = await overlap(doc10b, async () => [
    await enqueueAt(doc10b, stateOf(doc), windowStart + 9000),
    await enqueueAt(doc10b, stateOf(doc), windowStart + 11_000)
  ])
  check((ran.active ?? 0) >= 2, `next-window twin: both jobs ran at once (${ran.active} active)`)
  check(
    ran.done && failedAttempts === failedBefore,
    `next-window twin: no failed attempt (${failedAttempts - failedBefore})`
  )
  check((await rowCount(doc10b)) === 3, `next-window twin: one row (${await rowCount(doc10b)})`)
  check(
    (await outcomeCount('unchanged')) === unchangedBefore + 1,
    'next-window twin: counted as unchanged'
  )
}

await worker2.close()
await worker.close()

// 6. TTL re-arm, with no worker left to take the jobs off `wait`. BullMQ 6.x keeps
// paused jobs on `wait` too. The hand-pushed id covers the legacy `paused` list.

// A `make dev-local` worker on this Redis DB would eat these jobs and their keys,
// so the section skips and fails the run then. CLIENT LIST spans every DB, so count
// this DB only. Poll, because Redis can still list the closed worker for a moment.
const ownDb = String(stateRedis.options.db ?? 0)
const workersLeft = await pollFor(
  async () => (await StoreDocumentQueue.getWorkers()).filter((w) => w.db === ownDb).length,
  (n) => n === 0,
  3000
)
const noWorker = workersLeft === 0
check(noWorker, 'no other worker consumes the queue (section 6 needs none)')
if (noWorker) {
  const pendingJobIds: string[] = []
  const pausedList = StoreDocumentQueue.toKey('paused')
  const pausedJobId = buildStoreJobId(`${PREFIX}-doc6c`, poison)
  const pausedKey = `store-doc-state:${pausedJobId}`
  try {
    for (const name of ['doc6a', 'doc6b']) {
      const documentName = `${PREFIX}-${name}`
      const state = Buffer.from(yjsStateBase64(name), 'base64')
      const jobId = buildStoreJobId(documentName, state)
      await enqueueStoreDocument({
        jobId,
        documentName,
        state,
        context: { slug: documentName },
        commitMessage: 'e2e-6'
      })
      pendingJobIds.push(jobId)
      await stateRedis.expire(`store-doc-state:${jobId}`, 30)
    }
    await stateRedis.set(pausedKey, poison, 'EX', 30)
    await stateRedis.lpush(pausedList, pausedJobId)

    const refreshed = await refreshPendingStateKeyTtls()
    check(refreshed >= 3, `re-arm reports at least 3 keys (got ${refreshed})`)
    for (const jobId of pendingJobIds) {
      const key = `store-doc-state:${jobId}`
      check((await stateRedis.ttl(key)) > 3500, `wait job key re-armed (${key})`)
    }
    check((await stateRedis.ttl(pausedKey)) > 3500, 'paused-list job key re-armed')
  } finally {
    // A later worker must never pick these jobs up, even after a throw above.
    for (const jobId of pendingJobIds) await (await StoreDocumentQueue.getJob(jobId))?.remove()
    await stateRedis.lrem(pausedList, 0, pausedJobId)
    await stateRedis.del(...pendingJobIds.map((jobId) => `store-doc-state:${jobId}`), pausedKey)
  }
}

await cleanup()
await closeQueues()
await prisma.$disconnect()
await stateRedis.quit()
await disconnectRedis()

const { failed } = outcome()
console.log(failed ? '\nstore pipeline E2E: FAILED' : '\nstore pipeline E2E: PASSED')
process.exit(failed ? 1 : 0)
