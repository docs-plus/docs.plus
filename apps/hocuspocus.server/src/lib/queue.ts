import { Job, Queue, Worker } from 'bullmq'
import * as Y from 'yjs'

import { config } from '../config/env'
import type { DeadLetterJobData, StoreDocumentData } from '../types'
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

// Upsert document metadata with retry on slug collision (handles P2002)
function upsertDocumentMetadata(
  tx: TransactionClient,
  params: {
    documentId: string
    baseSlug: string
    title: string
    ownerId?: string
    email?: string
  },
  maxRetries = 3
): Promise<string> {
  return withUniqueSlug(
    params.baseSlug,
    async (slug) => {
      await tx.documentMetadata.upsert({
        where: { documentId: params.documentId },
        update: {
          title: params.title,
          description: params.title,
          ownerId: params.ownerId,
          email: params.email,
          keywords: ''
        },
        create: {
          documentId: params.documentId,
          slug,
          title: params.title,
          description: params.title,
          ownerId: params.ownerId,
          email: params.email,
          keywords: ''
        }
      })
      return slug
    },
    maxRetries
  )
}

// Queue connection (non-blocking operations). Tight command timeout on the
// producer only, so a slow-but-locked enqueue fails into the store hook's
// direct-DB fallback in seconds (a hard Redis outage never reaches it — the
// redlock aborts the store chain first). Never lower the shared 60s
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

// Main queue for storing documents
export const StoreDocumentQueue = new Queue<StoreDocumentData>('store-documents', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5, // Increased retry attempts for better reliability
    backoff: {
      type: 'exponential',
      delay: 2000 // Start with 2s delay
    },
    // BullMQ job keys carry no TTL, so volatile-lru can never evict them:
    // unbounded retention walks the shared Redis into OOM, which flips every
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

// Dead Letter Queue for permanently failed jobs
export const DeadLetterQueue = new Queue<DeadLetterJobData>('store-documents-dlq', {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 500,
      age: 30 * 24 * 3600 // Keep for 30 days
    }
  }
})

// Event handlers for monitoring and alerting
// Note: Queue events are handled by Worker events below for better reliability
StoreDocumentQueue.on('error', (err: Error) => {
  queueLogger.error({ err }, 'Queue error')
  captureUnknown(err)
})

// Claim-check: the raw Y.js buffer lives in its own TTL'd Redis key and the
// job carries only the reference — multi-MB base64 strings never ride through
// BullMQ's JSON serialization on the WS event loop or linger in job hashes.
const STATE_KEY_PREFIX = 'store-doc-state:'
// Covers the retry ladder (~30s) with wide margin. Accepted payload-less-DLQ
// paths: a job waiting >TTL for its FIRST run (worker outage/backlog), and
// volatile-lru evicting state keys under memory pressure (they are the only
// TTL'd keys whose loss matters). The next debounced save supersedes either.
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

export interface EnqueueStoreDocumentParams {
  jobId: string
  documentName: string
  state: Buffer
  context: StoreDocumentData['context']
  commitMessage: string
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
      commitMessage: params.commitMessage
    },
    { jobId: params.jobId }
  )
}

// A job can outlive the claim-check TTL in `wait` when the worker is down or
// backlogged — the 2026-07-14 outage turned that into payload-less DLQ
// entries. Re-arming pending jobs' key TTLs keeps any-length outages
// recoverable while the TTL stays the volatile-lru OOM backstop.
export async function refreshPendingStateKeyTtls(): Promise<number> {
  // Full range: getJobs start/end apply PER type, so "page by N" cannot bound
  // the aggregate anyway — and every list except `waiting` is already capped
  // (removeOnFail 200, delayed = retry ladder, active = concurrency).
  // `waiting` is the outage backlog this exists to cover; never truncate it.
  const jobs = await StoreDocumentQueue.getJobs(
    ['waiting', 'paused', 'delayed', 'active', 'failed'],
    0,
    -1
  )
  const pipeline = stateRedis.pipeline()
  for (const job of jobs) {
    if (job?.data?.stateKey) pipeline.expire(job.data.stateKey, STATE_KEY_TTL_SECONDS)
  }
  if (pipeline.length === 0) return 0
  const results = (await pipeline.exec()) ?? []
  return results.filter(([, result]) => result === 1).length
}

// Dequeue-liveness signal for the worker /health: a healthy worker bounds
// oldest-waiting age near zero; a parked fetch loop (dead blocking client)
// grows it forever with isRunning() still true. Retries back off in
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

// Worker to process document storage jobs
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

        // Decode + metadata strip run HERE, not in the WS store hook — this
        // is the CPU-heavy half of a save and it must stay off the event loop
        // that serves live connections.
        rawState = await resolveJobState(data)
        const snapshot = stripSnapshotMetadata(rawState)

        // READ COMMITTED + FOR UPDATE serializes appends but cannot stop two
        // concurrent jobs computing the same nextVersion (no row exists on
        // first creation; stale latest after the lock releases). The P2002 is
        // expected and healed by retries — snapshots are cumulative full state.
        const { savedDoc, createdSlug, isFirstCreation } = await prisma.$transaction(
          async (tx) => {
            // FOR UPDATE lock on the latest row; ORDER BY version is served
            // top-1 by the (documentId, version) unique index — id DESC had
            // no supporting index and scanned every version of the document.
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

            // Merge with the locked head: concurrent jobs can commit out of
            // order, and a plain INSERT would let a stale snapshot become the
            // newest version. merge(newer, stale) === newer; divergent
            // cross-replica flushes union instead of clobbering.
            const versionData = existingDoc
              ? Buffer.from(
                  Y.mergeUpdates([new Uint8Array(existingDoc.data), new Uint8Array(snapshot)])
                )
              : snapshot

            // Handle first-time document creation with retry on slug collision
            let slug: string | undefined
            if (isFirst) {
              const baseSlug = context.slug || data.documentName
              slug = await upsertDocumentMetadata(tx, {
                documentId: data.documentName,
                baseSlug,
                title: baseSlug,
                ownerId: context.user?.sub,
                email: context.user?.email
              })
            }

            // Create new version (within transaction = atomic)
            const doc = await tx.documents.create({
              data: {
                documentId: data.documentName,
                commitMessage: data.commitMessage || '',
                version: nextVersion,
                data: versionData
              }
            })

            return { savedDoc: doc, createdSlug: slug, isFirstCreation: isFirst }
          },
          // Under bursts jobs queue on the pool; waiting must degrade into
          // latency, not P2028 errors that burn the retry budget.
          { maxWait: 5000, timeout: 15000 }
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

        // Publish save confirmation to document-specific Redis channel
        if (redisPublisher) {
          await redisPublisher.publish(
            `doc:${data.documentName}:saved`,
            JSON.stringify({
              documentId: data.documentName,
              version: savedDoc.version,
              timestamp: Date.now()
            })
          )
        }

        return { success: true, version: savedDoc.version }
      } catch (err) {
        queueLogger.error({ err, jobId: job.id }, 'Error storing data for job')

        // Final attempt → DLQ. attemptsMade counts PRIOR attempts inside the
        // processor (BullMQ increments it in moveToFinished, after we throw),
        // so the final of N attempts sees N-1 — hence the +1.
        if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
          queueLogger.error({ jobId: job.id }, 'Job exhausted all retries. Moving to DLQ')
          captureUnknown(err)

          // Embed the payload inline while the claim-check key is still live;
          // a job that outwaited the TTL dead-letters payload-less (accepted —
          // the next debounced save supersedes it).
          let dlqState = data.state
          if (!dlqState && rawState) dlqState = rawState.toString('base64')
          if (!dlqState && data.stateKey) {
            const buf = await stateRedis.getBuffer(data.stateKey).catch(() => null)
            dlqState = buf?.toString('base64')
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
      // Lock settings for job ownership (prevents duplicate processing)
      // lockDuration: How long a job is "owned" by this worker before others can take it
      // lockRenewTime: How often to extend the lock (should be < lockDuration/2)
      lockDuration: 120000, // 2 minutes - job lock duration
      lockRenewTime: 30000, // 30s - auto-renew lock while processing

      // Stalled job detection (for crashed workers)
      // A job is "stalled" if worker dies mid-processing without releasing lock
      // stalledInterval: How often to check for stalled jobs
      // maxStalledCount: How many stall checks before marking as failed
      stalledInterval: 60000, // Check every 60s (was 30s - too aggressive)
      maxStalledCount: 2 // After 2 stalls (2 min), consider it failed
    }
  )

  // Worker event handlers
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
// released by close() (BullMQ owns them as shared) — the process exit reaps the
// sockets — so this just flushes and detaches the queues.
export const closeQueues = async () => {
  await Promise.all([StoreDocumentQueue.close(), DeadLetterQueue.close()])
}
