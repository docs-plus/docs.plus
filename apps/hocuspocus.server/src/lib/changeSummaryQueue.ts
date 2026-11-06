/**
 * The Version card's change summary runs as its own job, never on the persist path: one
 * summary decodes two snapshots and cost 99–148 ms on a 3.7 MB pair (#669).
 */
import { Job, Queue, Worker } from 'bullmq'

import { config } from '../config/env'
import { computeVersionChangeSummary } from '../modules/social-card/domain/versionChangeSummary'
import { toBullMQConnection } from '../types/redis.types'
import { CHANGE_SUMMARY_QUEUE_NAME } from './changeSummaryQueueName'
import { queueLogger } from './logger'
import { type ChangeSummaryOutcome, changeSummaryWritesTotal, recordJobOutcome } from './metrics'
import { prisma } from './prisma'
import {
  bullmqConnectionOptions,
  bullmqWorkerConnectionOptions,
  createRedisConnection
} from './redis'

interface ChangeSummaryJob {
  documentId: string
  version: number
}

const ATTEMPTS = 2

const count = (outcome: ChangeSummaryOutcome) => changeSummaryWritesTotal.inc({ outcome })

// Opened on first use (an enqueue, or the worker's depth sample), so REST opens no socket.
let queue: Queue<ChangeSummaryJob> | null = null

export const getChangeSummaryQueue = (): Queue<ChangeSummaryJob> => {
  if (queue) return queue
  const connection = toBullMQConnection(
    createRedisConnection({ ...bullmqConnectionOptions, commandTimeout: 5000 })
  )
  if (!connection) throw new Error('Redis configuration required for the change summary queue')
  queue = new Queue<ChangeSummaryJob>(CHANGE_SUMMARY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: ATTEMPTS,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100, age: 3600 },
      removeOnFail: { count: 100, age: 7 * 24 * 3600 }
    }
  })
  return queue
}

/**
 * Never throws: a summary that is never written leaves null, and the card falls back.
 * The Version card and the hovercard's version reply read it; each job decodes two snapshots.
 */
export const enqueueChangeSummary = (job: ChangeSummaryJob): void => {
  if (!config.socialCard.kinds.has('version')) return
  const warn = (err: unknown) =>
    queueLogger.warn({ err, ...job }, 'Failed to enqueue the version change summary')
  try {
    getChangeSummaryQueue()
      .add('summarize', job, { jobId: `${job.documentId}-v${job.version}` })
      .catch(warn)
  } catch (err) {
    warn(err)
  }
}

const summarize = async ({ documentId, version }: ChangeSummaryJob): Promise<void> => {
  // This version and the stored one before it. Retention may have thinned either.
  const rows = await prisma.$queryRaw<{ version: number; data: Uint8Array }[]>`
    SELECT version, data FROM "Documents"
    WHERE "documentId" = ${documentId} AND version <= ${version}
    ORDER BY version DESC
    LIMIT 2
  `
  const head = rows[0]
  if (head?.version !== version) {
    count('skipped')
    return
  }
  const summary = computeVersionChangeSummary(head.data, rows[1]?.data ?? null, (err, tocId) =>
    queueLogger.warn({ err, documentId, version, tocId }, 'Change summary section failed')
  )
  // Raw SQL, so `updatedAt` keeps the save time.
  const written = await prisma.$executeRaw`
    UPDATE "Documents" SET "changeSummary" = CAST(${JSON.stringify(summary)} AS jsonb)
    WHERE "documentId" = ${documentId} AND version = ${version}
  `
  count(written > 0 ? 'ok' : 'skipped')
}

export const createChangeSummaryWorker = () => {
  const connection = toBullMQConnection(createRedisConnection(bullmqWorkerConnectionOptions))
  if (!connection) throw new Error('Redis configuration required for the change summary worker')

  const worker = new Worker<ChangeSummaryJob>(
    CHANGE_SUMMARY_QUEUE_NAME,
    (job: Job<ChangeSummaryJob>) => summarize(job.data),
    { connection, concurrency: 1 }
  )

  worker.on('completed', (job) => recordJobOutcome(worker.name, 'completed', job))
  worker.on('failed', (job, err) => {
    recordJobOutcome(worker.name, 'failed')
    // This event fires on every attempt, after `moveToFailed` counted it, so the last sees ATTEMPTS.
    if (job && job.attemptsMade >= ATTEMPTS) count('failed')
    queueLogger.warn({ jobId: job?.id, err }, 'Version change summary failed')
  })
  worker.on('error', (err) => queueLogger.error({ err }, 'Change summary worker error'))

  return worker
}

export const closeChangeSummaryQueue = async (): Promise<void> => {
  await queue?.close()
}
