import { Job, Queue, Worker } from 'bullmq'
import * as Y from 'yjs'

import { config } from '../config/env'
import type { DeadLetterJobData, EnqueueStoreDocumentParams, StoreDocumentData } from '../types'
import { toBullMQConnection } from '../types/redis.types'
import { sendNewDocumentNotification } from './email/document-notification'
import { captureUnknown } from './instrument'
import { queueLogger } from './logger'
import { recordJobOutcome } from './metrics'
import { prisma } from './prisma'
import {
  bullmqConnectionOptions,
  bullmqWorkerConnectionOptions,
  createRedisConnection,
  getRedisPublisher
} from './redis'
import { withUniqueSlug } from './slug'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Upsert document metadata under a caller-chosen slug. The slug-collision retry
// belongs to the caller, OUTSIDE the transaction. A P2002 aborts the Postgres
// transaction, so a retry in here can only ever hit 25P02 and lose the save.
async function upsertDocumentMetadata(
  tx: TransactionClient,
  params: {
    documentId: string
    slug: string
    title: string
    ownerId?: string
    email?: string
  }
): Promise<string> {
  const row = await tx.documentMetadata.upsert({
    where: { documentId: params.documentId },
    // A content persist must NOT own metadata: the anchor, the PUT and
    // createDocument all set more authoritative values than title=slug.
    // Overwriting reverted a user-set title on reload and could flip ownerId to
    // the last flusher. UPDATE is therefore a no-op, and CREATE is the no-row backstop.
    update: {},
    create: {
      documentId: params.documentId,
      slug: params.slug,
      title: params.title,
      description: params.title,
      ownerId: params.ownerId,
      email: params.email,
      keywords: ''
    }
  })
  // The row's slug, never the candidate. On the update branch the caller's
  // candidate can name a slug that is not in the database, and it reaches
  // the new-document email's documentUrl.
  return row.slug
}

// Queue connection (non-blocking operations). Tight command timeout on the
// producer only, so a slow-but-locked enqueue fails into the store hook's
// direct-DB fallback in seconds. A hard Redis outage never reaches that fallback —
// the redlock aborts the store chain first. Never lower the shared 60s
// REDIS_COMMAND_TIMEOUT: it would race the workers' blocking bzpopmin.
const redisClient = createRedisConnection({ ...bullmqConnectionOptions, commandTimeout: 5000 })
const queueConnection = toBullMQConnection(redisClient)

if (!redisClient || !queueConnection) {
  queueLogger.error('Failed to create Redis connection for BullMQ Queue')
  throw new Error('Redis configuration required for queue operations')
}

// Non-null alias: the throw above guarantees it, but the narrowing does not
// survive into the closures below.
const stateRedis = redisClient

// Worker connection (blocking operations - MUST be separate)
// BullMQ uses BRPOPLPUSH which blocks the connection
const createWorkerConnection = () => {
  const conn = createRedisConnection(bullmqWorkerConnectionOptions)
  const bullmqConn = toBullMQConnection(conn)
  if (!bullmqConn) {
    queueLogger.error('Failed to create Redis connection for BullMQ Worker')
    throw new Error('Redis configuration required for worker operations')
  }
  return bullmqConn
}

export const StoreDocumentQueue = new Queue<StoreDocumentData>('store-documents', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    // BullMQ job keys carry no TTL, so volatile-lru can never evict them.
    // Unbounded retention walks the shared Redis into OOM, which flips every
    // save onto the inline DB fallback. The DLQ keeps the recovery payloads.
    removeOnComplete: {
      count: 100,
      age: 3600
    },
    removeOnFail: {
      count: 200,
      age: 7 * 24 * 3600
    }
  }
})

// Dead Letter Queue for permanently failed jobs. Nothing here expires on its
// own. No worker completes a DLQ job, so removeOnComplete below never fires and
// drainStoreDeadLetterQueue's job.remove() is the only thing that clears an entry.
export const DeadLetterQueue = new Queue<DeadLetterJobData>('store-documents-dlq', {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 500,
      age: 30 * 24 * 3600
    }
  }
})

// scripts/drain-store-dlq.ts is the only consumer, so entries are retained until
// an operator replays them and the depth alert is the bound. Cap the inline blob
// anyway: a sustained store failure must not accumulate multi-MB base64 into the
// Redis OOM the main queue's bounds guard.
const DLQ_MAX_INLINE_STATE_BYTES = 512 * 1024

// Only 'error' is wired here; the rest of the job events ride the Worker below.
StoreDocumentQueue.on('error', (err: Error) => {
  queueLogger.error({ err }, 'Queue error')
  captureUnknown(err)
})

// Claim-check: the raw Y.js buffer lives in its own TTL'd Redis key and the job
// carries only the reference. Multi-MB base64 strings never ride through BullMQ's
// JSON serialization on the WS event loop or linger in job hashes.
const STATE_KEY_PREFIX = 'store-doc-state:'
// Covers the retry ladder (~30s) with wide margin. Accepted payload-less-DLQ
// paths: a job waiting >TTL for its FIRST run (worker outage/backlog), and
// volatile-lru evicting state keys under memory pressure. Those state keys are
// the only TTL'd keys whose loss matters. The next debounced save supersedes either.
const STATE_KEY_TTL_SECONDS = 3600

// Colon-free by contract: BullMQ reserves ':' as its Redis key separator and
// validateOptions throws on custom ids containing it — '-' joins, always.
// The 10s window + state fingerprint dedupes identical cross-instance saves
// while a byte-different final flush in the same window still lands.
export function buildStoreJobId(documentName: string, state: Uint8Array): string {
  const timeWindow = Math.floor(Date.now() / 10000)
  const stateHash = Bun.hash(state).toString(36)
  return `doc-${documentName.replaceAll(':', '_')}-${timeWindow}-${state.byteLength}-${stateHash}`
}

export async function enqueueStoreDocument(params: EnqueueStoreDocumentParams): Promise<void> {
  const stateKey = STATE_KEY_PREFIX + params.jobId
  await stateRedis.set(stateKey, params.state, 'EX', STATE_KEY_TTL_SECONDS)
  await StoreDocumentQueue.add(
    'store-document',
    {
      documentName: params.documentName,
      stateKey,
      context: params.context,
      commitMessage: params.commitMessage,
      trigger: params.trigger,
      triggeredBy: params.triggeredBy,
      contributors: params.contributors
    },
    { jobId: params.jobId }
  )
}

export interface StoreDlqEntry {
  jobId: string
  documentName: string
  stateBytes: number
  /** Newest stored version, or null when no row exists — a replay would email. */
  headVersion: number | null
  /** A row landed after this entry failed, so the replay likely duplicates it. */
  headSupersedes: boolean
  failureReason?: string
  failedAt?: string
  /** `discard` also covers a payload too old to replay — see isPastDeleteRetention. */
  disposition: 'replay' | 'discard' | 'skip-trashed'
}

export interface StoreDlqDrainResult {
  entries: StoreDlqEntry[]
  replayed: number
  discarded: number
  /** Trashed entries — removed on apply, not parked: the live path refused those saves. */
  skipped: number
  /** The whole parked queue, never the `documentId`-filtered slice. */
  depth: number
}

// One hydrated slice per pass. An entry embeds up to DLQ_MAX_INLINE_STATE_BYTES
// as base64. Hydrating a whole queue to read its data is the +428 MB mistake
// refreshPendingStateKeyTtls exists to avoid.
const DLQ_DRAIN_BATCH = 50

// DLQ states with no worker to move them. BullMQ appends 'paused' whenever
// 'waiting' is present and applies the range per type. Both the count and the
// slice below are therefore wider than these three names suggest.
const DLQ_PARKED_STATES = ['waiting', 'delayed', 'prioritized'] as const

// Past this age the entry's document may have been hard-purged, which erases the
// metadata row and cascades the versions. A replay then reads as a first save,
// recreates the document under the DLQ's owner and re-sends its creation email.
// Nothing here can tell that from a first save genuinely lost.
const DELETE_RETENTION_MS = config.worker.deleteRetentionDays * 24 * 60 * 60 * 1000

// deleteRetentionDays 0 disables the reaper, so no entry can go stale.
const isPastDeleteRetention = (failedAt: string | undefined): boolean => {
  if (!failedAt || DELETE_RETENTION_MS <= 0) return false
  const failed = new Date(failedAt).getTime()
  return Number.isFinite(failed) && Date.now() - failed > DELETE_RETENTION_MS
}

// Replays dead-lettered saves through enqueueStoreDocument so the worker's
// FOR UPDATE merge stays the only code that appends a version. Operator-driven
// (scripts/drain-store-dlq.ts): every entry failed five attempts, so an
// unattended loop would re-run a persistent failure forever.
export async function drainStoreDeadLetterQueue({
  apply,
  documentId
}: {
  apply: boolean
  /** Narrows the pass to one document. Omit for the operator's drain, which
   * must stay unfiltered. Matched against `documentName`: a DLQ entry names the
   * room, and the room name is the documentId. */
  documentId?: string
}): Promise<StoreDlqDrainResult> {
  const counts = await DeadLetterQueue.getJobCounts(...DLQ_PARKED_STATES)
  // Filtered inside the same batch window, never by scanning further. BullMQ has
  // no server-side predicate on job data. Hydrating past the batch to find one
  // document is the +428 MB mistake DLQ_DRAIN_BATCH exists to bound. An entry
  // parked past the window is invisible to a filtered pass.
  const jobs = (await DeadLetterQueue.getJobs([...DLQ_PARKED_STATES], 0, DLQ_DRAIN_BATCH - 1))
    .slice(0, DLQ_DRAIN_BATCH)
    .filter((job) => documentId === undefined || job.data.documentName === documentId)
  const documentIds = [...new Set(jobs.map((job) => job.data.documentName))]

  // The live path refuses a save on a soft-deleted document, so a replay must not
  // resurrect one behind the operator's back. The newest row decides the rest.
  // `createdAt` against `failedAt` is the only thing saying whether the payload is
  // already superseded. No row at all means the replay re-fires the email.
  const [trashedRows, headRows] = await Promise.all([
    prisma.documentMetadata.findMany({
      where: { documentId: { in: documentIds }, deletedAt: { not: null } },
      select: { documentId: true }
    }),
    prisma.documents.groupBy({
      by: ['documentId'],
      where: { documentId: { in: documentIds } },
      _max: { version: true, createdAt: true }
    })
  ])
  const trashed = new Set(trashedRows.map((row) => row.documentId))
  const heads = new Map(headRows.map((row) => [row.documentId, row._max]))

  const result: StoreDlqDrainResult = {
    entries: [],
    replayed: 0,
    discarded: 0,
    skipped: 0,
    depth: Object.values(counts).reduce((sum, n) => sum + n, 0)
  }

  for (const job of jobs) {
    const data = job.data
    const state = data.state ? Buffer.from(data.state, 'base64') : null
    const disposition: StoreDlqEntry['disposition'] = trashed.has(data.documentName)
      ? 'skip-trashed'
      : state && !isPastDeleteRetention(data.failedAt)
        ? 'replay'
        : 'discard'

    // Reported, never acted on. A later snapshot only carries what the saving
    // client held, so a stranded edit from another client can survive a newer
    // head. Auto-skipping on this would eat real recoveries. Scoped to 'replay'
    // because only a replay can mint the duplicate this warns about.
    const head = heads.get(data.documentName)
    const headSupersedes =
      disposition === 'replay' &&
      Boolean(head?.createdAt && data.failedAt && head.createdAt > new Date(data.failedAt))

    result.entries.push({
      jobId: job.id ?? '(no id)',
      documentName: data.documentName,
      stateBytes: state?.byteLength ?? 0,
      headVersion: head?.version ?? null,
      headSupersedes,
      failureReason: data.failureReason,
      failedAt: data.failedAt,
      disposition
    })
    if (disposition === 'replay') result.replayed += 1
    if (disposition === 'discard') result.discarded += 1
    if (disposition === 'skip-trashed') result.skipped += 1

    if (!apply) continue

    // Every disposition ends in remove(). Parking a refused entry is what let the
    // reaper age it into a replayable one and resurrect the document on a timer.
    // A trashed entry is no recovery candidate either — the live path (see above)
    // already refused that save while the document was in the trash.
    if (disposition === 'replay' && state) {
      // Copied field by field, not spread. The DLQ carries `state` as base64 and
      // `commitMessage` as optional. The producer takes a Buffer and a required
      // string, and mints its own claim-check key from the new jobId.
      await enqueueStoreDocument({
        jobId: buildStoreJobId(data.documentName, state),
        documentName: data.documentName,
        state,
        context: data.context,
        commitMessage: data.commitMessage ?? '',
        trigger: data.trigger,
        triggeredBy: data.triggeredBy,
        contributors: data.contributors
      })
    }
    // Removed only after the replacement is queued: a duplicate replay costs one
    // extra version row, a lost entry costs the save.
    await job.remove()
  }

  return result
}

// ioredis buffers every queued command until exec(), so the EXPIREs go out in
// chunks. One flat pipeline over a 50k backlog held +164 MB on its own.
const TTL_REFRESH_CHUNK = 1000

// A job can outlive the claim-check TTL in `wait` when the worker is down or
// backlogged — the 2026-07-14 outage turned that into payload-less DLQ
// entries. Re-arming pending jobs' key TTLs keeps any-length outages
// recoverable while the TTL stays the volatile-lru OOM backstop.
export async function refreshPendingStateKeyTtls(): Promise<number> {
  // Ids off the list, never getJobs. Hydrating every job hash just to read a key
  // that enqueueStoreDocument derives from the job id cost +428 MB of WS heap at
  // a 50k backlog. Queue.pause() RENAMEs wait→paused, so the backlog this covers
  // answers to either name and only one of the two lists exists at a time.
  const [waiting, paused] = await Promise.all([
    stateRedis.lrange(StoreDocumentQueue.toKey('wait'), 0, -1),
    stateRedis.lrange(StoreDocumentQueue.toKey('paused'), 0, -1)
  ])
  const jobIds = waiting.concat(paused)

  let refreshed = 0
  for (let start = 0; start < jobIds.length; start += TTL_REFRESH_CHUNK) {
    const end = Math.min(start + TTL_REFRESH_CHUNK, jobIds.length)
    const pipeline = stateRedis.pipeline()
    for (let i = start; i < end; i++) {
      pipeline.expire(STATE_KEY_PREFIX + jobIds[i], STATE_KEY_TTL_SECONDS)
    }
    const results = (await pipeline.exec()) ?? []
    refreshed += results.filter(([, result]) => result === 1).length
  }
  return refreshed
}

// Dequeue-liveness signal for the worker /health: a healthy worker bounds
// oldest-waiting age near zero. A parked fetch loop (dead blocking client)
// grows that age forever with isRunning() still true. Retries back off in
// `delayed`, so this cannot false-positive on the retry ladder.
export async function getStoreQueueOldestWaitingAgeMs(): Promise<number | null> {
  // Range [-1, -1] = the wait list's tail — BullMQ LPUSHes new jobs onto the
  // head, so the tail is the oldest waiting job.
  const [oldest] = await StoreDocumentQueue.getJobs(['waiting'], -1, -1)
  return oldest ? Date.now() - oldest.timestamp : null
}

// Stored snapshots must not carry the transient metadata keys the client
// stamps on the live doc (commitMessage rides the version row instead).
export function stripSnapshotMetadata(state: Uint8Array) {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, state instanceof Buffer ? new Uint8Array(state) : state)
  const meta = ydoc.getMap('metadata')
  meta.delete('commitMessage')
  meta.delete('isDraft')
  return Buffer.from(Y.encodeStateAsUpdate(ydoc))
}

async function resolveJobState(data: StoreDocumentData): Promise<Buffer> {
  if (data.stateKey) {
    const buf = await stateRedis.getBuffer(data.stateKey)
    if (buf) return buf
  }
  if (data.state) return Buffer.from(data.state, 'base64')
  throw new Error(`Store job state missing or expired (${data.stateKey ?? 'no stateKey'})`)
}

export const createDocumentWorker = () => {
  const redisPublisher = getRedisPublisher()
  // Worker MUST have dedicated connection (uses blocking commands)
  const workerConnection = createWorkerConnection()

  const worker = new Worker<StoreDocumentData>(
    'store-documents',
    async (job: Job<StoreDocumentData>) => {
      const { data } = job
      let rawState: Buffer | null = null

      try {
        const startTime = Date.now()
        const context = data.context

        // Decode + metadata strip run in this worker, never in the WS store hook.
        // That work is the CPU-heavy half of a save and it must stay off the event
        // loop serving live connections.
        rawState = await resolveJobState(data)
        const incoming = new Uint8Array(rawState)

        // READ COMMITTED + FOR UPDATE serializes appends but cannot stop two
        // concurrent jobs computing the same nextVersion. No row exists on first
        // creation; stale latest after the lock releases. The P2002 is expected
        // and healed by retries — snapshots are cumulative full state.
        const baseSlug = context.slug || data.documentName

        // The slug retry wraps the WHOLE transaction. A P2002 aborts the Postgres
        // transaction, so retrying inside it only ever hit 25P02, and the next
        // debounce re-enqueued into the same dead end.
        const { savedDoc, createdSlug, isFirstCreation } = await withUniqueSlug(
          baseSlug,
          (candidateSlug) =>
            prisma.$transaction(
              async (tx) => {
                // FOR UPDATE lock on the latest row. ORDER BY version is served
                // top-1 by the (documentId, version) unique index. ORDER BY id DESC
                // had no supporting index and scanned every version of the document.
                const existingDocs = await tx.$queryRaw<
                  { id: number; version: number; data: Buffer }[]
                >`
            SELECT id, version, data FROM "Documents"
            WHERE "documentId" = ${data.documentName}
            ORDER BY version DESC
            LIMIT 1
            FOR UPDATE
          `
                const existingDoc = existingDocs[0] ?? null

                const isFirst = !existingDoc
                const nextVersion = existingDoc ? existingDoc.version + 1 : 1

                // Merge with the locked head so an out-of-order commit cannot make a
                // stale snapshot the newest version, and divergent replicas union.
                // Merge RAW and strip the RESULT: mergeUpdates only unions delete
                // sets, so the strip's decode is what drops deleted text.
                const versionData = existingDoc
                  ? stripSnapshotMetadata(
                      Y.mergeUpdates([new Uint8Array(existingDoc.data), incoming])
                    )
                  : stripSnapshotMetadata(incoming)

                // Handle first-time document creation; the title stays the BASE
                // slug, so a collision suffixes the slug without renaming the doc.
                let slug: string | undefined
                if (isFirst) {
                  slug = await upsertDocumentMetadata(tx, {
                    documentId: data.documentName,
                    slug: candidateSlug,
                    title: baseSlug,
                    ownerId: context.user?.sub,
                    email: context.user?.email
                  })
                }

                // Create new version (within transaction = atomic). Attribution is
                // read top-level only: the serialized context carries a second copy
                // whose explicit null the store hook has already resolved.
                const doc = await tx.documents.create({
                  data: {
                    documentId: data.documentName,
                    commitMessage: data.commitMessage || '',
                    version: nextVersion,
                    data: versionData,
                    trigger: data.trigger ?? null,
                    triggeredBy: data.triggeredBy ?? null,
                    contributors: data.contributors ?? []
                  }
                })

                return { savedDoc: doc, createdSlug: slug, isFirstCreation: isFirst }
              },
              // Under bursts jobs queue on the pool; waiting must degrade into
              // latency, not P2028 errors that burn the retry budget.
              { maxWait: 5000, timeout: 15000 }
            )
        )

        // Claim-check key served its purpose; TTL remains the backstop.
        if (data.stateKey) {
          stateRedis.del(data.stateKey).catch(() => {})
        }

        const duration = Date.now() - startTime
        queueLogger.info(
          { jobId: job.id, duration: `${duration}ms` },
          'Document stored successfully'
        )

        // Send email notification AFTER transaction commits (fire-and-forget)
        if (isFirstCreation && createdSlug) {
          const userMeta = context.user?.user_metadata
          setImmediate(() => {
            sendNewDocumentNotification({
              documentId: data.documentName,
              documentName: context.slug || data.documentName,
              slug: createdSlug,
              creatorEmail: context.user?.email,
              creatorId: context.user?.sub,
              creatorName: userMeta?.full_name || userMeta?.name,
              creatorAvatarUrl: userMeta?.avatar_url,
              createdAt: new Date()
            }).catch((err) => {
              queueLogger.error(
                { err, documentId: data.documentName },
                'Failed to send new document notification email'
              )
            })
          })
        }

        // Publish save confirmation (fire-and-forget, like the email above).
        // The save is already committed and the claim-check key is deleted. An
        // awaited reject here would therefore re-throw a durable save into a
        // payload-less DLQ retry plus a false 'failed' metric.
        if (redisPublisher) {
          redisPublisher
            .publish(
              `doc:${data.documentName}:saved`,
              JSON.stringify({
                documentId: data.documentName,
                version: savedDoc.version,
                timestamp: Date.now()
              })
            )
            .catch((err) => {
              queueLogger.error(
                { err, documentId: data.documentName },
                'Failed to publish save confirmation'
              )
            })
        }

        return { success: true, version: savedDoc.version }
      } catch (err) {
        queueLogger.error({ err, jobId: job.id }, 'Error storing data for job')

        // Final attempt → DLQ. `attemptsMade` counts PRIOR attempts inside the
        // processor (BullMQ increments it in moveToFinished, after we throw). The
        // final of N attempts therefore sees N-1 — hence the +1.
        if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
          queueLogger.error({ jobId: job.id }, 'Job exhausted all retries. Moving to DLQ')
          captureUnknown(err)

          // Embed the recovery payload inline while the claim-check key is live.
          // Embed it only when it is small enough to be a safe DLQ resident (see
          // DLQ_MAX_INLINE_STATE_BYTES). A large or outwaited-TTL state
          // dead-letters payload-less — the next debounced save supersedes it.
          let dlqState = data.state
          if (!dlqState) {
            const recoverySource =
              rawState ??
              (data.stateKey ? await stateRedis.getBuffer(data.stateKey).catch(() => null) : null)
            if (recoverySource && recoverySource.byteLength <= DLQ_MAX_INLINE_STATE_BYTES) {
              dlqState = recoverySource.toString('base64')
            }
          }

          const dlqData: DeadLetterJobData = {
            ...data,
            state: dlqState,
            originalJobId: job.id ?? undefined,
            failureReason: err instanceof Error ? err.message : 'Unknown error',
            failedAt: new Date().toISOString()
          }
          await DeadLetterQueue.add('failed-document', dlqData)
          if (data.stateKey) {
            stateRedis.del(data.stateKey).catch(() => {})
          }
        }

        throw err // Re-throw to trigger retry
      }
    },
    {
      connection: workerConnection,
      concurrency: config.bullmq.concurrency,
      limiter: {
        max: config.bullmq.rateLimitMax,
        duration: config.bullmq.rateLimitDuration
      },
      // Lock settings for job ownership (prevents duplicate processing);
      // lockRenewTime must stay below lockDuration/2.
      lockDuration: 120000,
      lockRenewTime: 30000,

      // A job is "stalled" if a worker dies mid-processing without releasing its lock.
      stalledInterval: 60000, // 30s was too aggressive
      maxStalledCount: 2 // After 2 stalls (2 min), consider it failed
    }
  )

  worker.on('completed', (job) => {
    recordJobOutcome(worker.name, 'completed', job)
    queueLogger.info({ jobId: job.id }, 'Job completed successfully')
  })

  worker.on('failed', (job, err) => {
    recordJobOutcome(worker.name, 'failed')
    if (job) {
      queueLogger.error({ jobId: job.id, err }, 'Worker: Job failed')
    }
  })

  worker.on('error', (err) => {
    queueLogger.error({ err }, 'Worker error')
    captureUnknown(err)
  })

  worker.on('stalled', (jobId) => {
    queueLogger.warn({ jobId }, 'Worker: Job stalled')
    recordJobOutcome(worker.name, 'stalled')
  })

  return worker
}

// Stop the producer queues on shutdown. The shared ioredis connections aren't
// released by close() (BullMQ owns them as shared). The process exit reaps the
// sockets, so this just flushes and detaches the queues.
export const closeQueues = async () => {
  await Promise.all([StoreDocumentQueue.close(), DeadLetterQueue.close()])
}
