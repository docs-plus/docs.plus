import { randomUUID } from 'node:crypto'

import { Job, Queue, UnrecoverableError, Worker } from 'bullmq'

import { config } from '../../config/env'
import type {
  EmailDLQData,
  EmailDlqDrainResult,
  EmailJobData,
  EmailResult,
  QueuedEmail
} from '../../types/email.types'
import { toBullMQConnection } from '../../types/redis.types'
import { captureUnknown } from '../instrument'
import { emailLogger } from '../logger'
import { maskEmailsIn } from '../maskEmail'
import { recordJobOutcome } from '../metrics'
import { prisma } from '../prisma'
import {
  bullmqConnectionOptions,
  bullmqWorkerConnectionOptions,
  createRedisConnection
} from '../redis'
import { judgeEmailDlqEntry } from './dlqDisposition'
import { decideEmailFailure, emailFailureKind } from './failureDecision'
import { EMAIL_DLQ_NAME, EMAIL_QUEUE_NAME, providerIdempotencyKey, sentLogKey } from './jobIdentity'
import { EmailSendError } from './providers/types'
import {
  buildEmailMessage,
  deliverEmail,
  readyEmailDelivery,
  sendEmailInline,
  updateSupabaseEmailStatus
} from './sender'

const redisClient = createRedisConnection(bullmqConnectionOptions)
const queueConnection = toBullMQConnection(redisClient)

if (!queueConnection) {
  emailLogger.warn('Redis not configured - email queue will not be available')
}

// 30 + 60 + 120 + 240 + 480 s: about 15 min of retries, so a short provider
// outage heals on its own. Only a transient failure uses the ladder.
const EMAIL_JOB_ATTEMPTS = 6

export const EmailQueue = queueConnection
  ? new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: EMAIL_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 30_000
        },
        removeOnComplete: {
          count: 500,
          age: 24 * 3600
        },
        // EmailDeadLetterQueue already holds the payload and the failure reason
        // from the final attempt. An unbounded failed set is therefore a second copy
        // in the Redis that also holds every claim-check payload. `getFailedCount()`
        // below therefore reports a 200/7-day window, not a lifetime total.
        removeOnFail: {
          count: 200,
          age: 7 * 24 * 3600
        }
      }
    })
  : null

export const EmailDeadLetterQueue = queueConnection
  ? new Queue<EmailDLQData>(EMAIL_DLQ_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        removeOnComplete: {
          count: 200,
          age: 30 * 24 * 3600
        }
      }
    })
  : null

EmailQueue?.on('error', (err: Error) => {
  emailLogger.error({ err }, 'Email queue error')
  captureUnknown(err)
})

/** The email_queue rows a job settles: one for a notification, several for a digest. */
const queueIdsOf = ({ payload }: EmailJobData): string[] => {
  if ('queue_id' in payload) return [payload.queue_id]
  if ('queue_ids' in payload) return payload.queue_ids ?? []
  return []
}

const settleQueueRows = (
  data: EmailJobData,
  status: 'sent' | 'failed' | 'skipped',
  error?: string
) =>
  Promise.all(
    queueIdsOf(data).map((queue_id) =>
      updateSupabaseEmailStatus({
        queue_id,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : undefined,
        error_message: error
      })
    )
  )

export function createEmailWorker() {
  if (!queueConnection) {
    emailLogger.warn('Cannot create email worker - Redis not configured')
    return null
  }

  // Worker needs dedicated connection (uses blocking commands)
  const workerRedis = createRedisConnection(bullmqWorkerConnectionOptions)
  const workerConnection = toBullMQConnection(workerRedis)

  if (!workerConnection) {
    emailLogger.error('Failed to create worker Redis connection')
    return null
  }

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>): Promise<EmailResult> => {
      const { data } = job
      const startTime = Date.now()
      const jobId = String(job.id)
      const logKey = sentLogKey(jobId)

      emailLogger.info({ jobId: job.id, type: data.type }, 'Processing email job')

      try {
        const existingSend = await prisma.emailSentLog.findUnique({
          where: { idempotencyKey: logKey }
        })

        if (existingSend) {
          emailLogger.info(
            { jobId: job.id, originalMessageId: existingSend.messageId },
            'Email already sent (idempotent skip)'
          )
          // The first run can die between the send and the settle.
          await settleQueueRows(data, 'sent')
          return {
            success: true,
            message_id: existingSend.messageId || undefined,
            deduplicated: true
          }
        }

        // `off` is a decision, not a failure: no retry, no dead letter.
        if (config.email.delivery.status === 'off') {
          await settleQueueRows(data, 'skipped', 'email not configured')
          emailLogger.info({ jobId: job.id, type: data.type }, 'Email job skipped: not configured')
          return { success: false, skipped: true, error: 'email not configured' }
        }

        const { keyNamespace } = readyEmailDelivery()
        const sent = await deliverEmail(buildEmailMessage(data), {
          jobId,
          idempotencyKey: providerIdempotencyKey(keyNamespace, jobId)
        })

        // Recorded before the settle, so a retry after a crash here dedupes.
        const recipient = Array.isArray(data.payload.to)
          ? data.payload.to[0] || 'unknown'
          : data.payload.to
        await prisma.emailSentLog
          .create({
            data: {
              idempotencyKey: logKey,
              messageId: sent.messageId,
              recipient: String(recipient),
              emailType: data.type
            }
          })
          .catch((logErr: unknown) => {
            // Log but don't fail - email was sent successfully
            emailLogger.warn(
              { err: logErr, jobId: job.id },
              'Failed to record email send in idempotency log'
            )
          })
        await settleQueueRows(data, 'sent')

        emailLogger.info(
          {
            jobId: job.id,
            durationMs: Date.now() - startTime,
            messageId: sent.messageId,
            queueIds: queueIdsOf(data)
          },
          'Email job completed'
        )
        return { success: true, message_id: sent.messageId }
      } catch (err) {
        const attempts = job.opts.attempts ?? EMAIL_JOB_ATTEMPTS
        const action = decideEmailFailure(err, job.attemptsMade, attempts)
        const failureKind = emailFailureKind(err)
        // A Prisma or template error can quote an address too.
        const message = maskEmailsIn(err instanceof Error ? err.message : String(err))
        // deliverEmail already logged a provider error with `err`. A second
        // `err` line here would count one failure twice in the err_kind alerts.
        if (err instanceof EmailSendError) {
          emailLogger.warn({ jobId: job.id, failureKind, action }, 'Email job failed')
        } else {
          emailLogger.error({ err, jobId: job.id, action }, 'Email job failed')
        }
        if (action === 'retry') throw err

        emailLogger.error({ jobId: job.id, failureKind }, 'Email moved to DLQ')
        captureUnknown(err)
        await settleQueueRows(
          data,
          'failed',
          `${failureKind} failure on attempt ${job.attemptsMade + 1}: ${message}`
        )

        const dlqData: EmailDLQData = {
          ...data,
          originalJobId: job.id ?? undefined,
          failureReason: message,
          failureKind,
          failureCode: err instanceof EmailSendError ? err.code : undefined,
          failedAt: new Date().toISOString()
        }
        await EmailDeadLetterQueue?.add('failed-email', dlqData).catch((dlqErr: unknown) => {
          emailLogger.error({ err: dlqErr, jobId: job.id }, 'Failed to add email to DLQ')
        })

        // The DLQ owns the mail now, so BullMQ must not retry it.
        throw new UnrecoverableError(message)
      }
    },
    {
      connection: workerConnection,
      concurrency: config.email.gateway.workerConcurrency,
      limiter: {
        max: config.email.gateway.rateLimitMax,
        duration: config.email.gateway.rateLimitDuration
      },
      lockDuration: 60000, // email sending is typically fast
      lockRenewTime: 15000,
      stalledInterval: 30000,
      maxStalledCount: 2 // 1 min total before marking stalled
    }
  )

  worker.on('completed', (job) => {
    recordJobOutcome(worker.name, 'completed', job)
    emailLogger.debug({ jobId: job.id }, 'Email job completed')
  })

  // A job that stalls past maxStalledCount fails here and never reaches the
  // processor catch. No `err` key, so each err_kind count stays one line.
  worker.on('failed', (job, err) => {
    recordJobOutcome(worker.name, 'failed')
    emailLogger.warn(
      { jobId: job?.id, attempts: job?.attemptsMade, failedReason: maskEmailsIn(err.message) },
      'Email job attempt failed'
    )
  })

  worker.on('error', (err) => {
    emailLogger.error({ err }, 'Email worker error')
    captureUnknown(err)
  })

  emailLogger.info('Email worker started')

  return worker
}

/**
 * A stable `jobId` (a pgmq business id) makes a redelivery re-add the same job
 * instead of a duplicate. Without one, a UUID: BullMQ counter ids restart after
 * a Redis reset, and the sent log would skip a new mail as already sent.
 */
export async function queueEmail(data: EmailJobData, jobId?: string): Promise<QueuedEmail> {
  if (!EmailQueue) {
    emailLogger.warn('Email queue not available - sending synchronously')
    const result = await sendEmailInline(data)
    await settleQueueRows(
      data,
      result.success ? 'sent' : result.skipped ? 'skipped' : 'failed',
      result.error
    )
    return { inline: result }
  }

  const id = jobId ?? randomUUID()
  await EmailQueue.add('send-email', data, {
    priority: data.type === 'notification' ? 1 : 2,
    jobId: id
  })

  emailLogger.debug({ jobId: id, type: data.type }, 'Email queued')

  return { jobId: id }
}

// One hydrated slice per pass, like the store drain.
const EMAIL_DLQ_DRAIN_BATCH = 50
const EMAIL_DLQ_PARKED_STATES = ['waiting', 'delayed', 'prioritized'] as const

/**
 * Replays through queueEmail with the original job id, so the replay gets the
 * full retry ladder and the same provider key. Never `job.retry()`: it keeps
 * `attemptsMade`. The sent log still blocks a mail that already went out.
 */
export async function drainEmailDeadLetterQueue({
  apply
}: {
  apply: boolean
}): Promise<EmailDlqDrainResult> {
  if (!EmailQueue || !EmailDeadLetterQueue) throw new Error('Redis not configured')

  const depth = (await getEmailDlqDepth()) ?? 0
  const jobs = (
    await EmailDeadLetterQueue.getJobs([...EMAIL_DLQ_PARKED_STATES], 0, EMAIL_DLQ_DRAIN_BATCH - 1)
  ).slice(0, EMAIL_DLQ_DRAIN_BATCH)
  const result: EmailDlqDrainResult = { entries: [], depth }

  for (const job of jobs) {
    const { originalJobId, failureKind, failedAt, type, payload, created_at } = job.data
    const disposition = judgeEmailDlqEntry({ failureKind, failedAt }, Date.now())
    result.entries.push({ id: job.id ?? '(no id)', failureKind, disposition })
    if (!apply || disposition === 'unresolved') continue

    if (disposition === 'replay') {
      // BullMQ ignores an add whose id still names a job, and the failed
      // original stays for up to 7 days.
      const original = originalJobId ? await EmailQueue.getJob(originalJobId) : undefined
      if (original && (await original.isFailed())) await original.remove()
      await queueEmail({ type, payload, created_at }, originalJobId)
    }
    // Removed only after the replay is queued: a lost entry costs the mail.
    await job.remove()
  }

  return result
}

/** Entries the drain would see. Null when there is no Redis. */
export async function getEmailDlqDepth(): Promise<number | null> {
  if (!EmailDeadLetterQueue) return null
  const counts = await EmailDeadLetterQueue.getJobCounts(...EMAIL_DLQ_PARKED_STATES)
  return EMAIL_DLQ_PARKED_STATES.reduce((sum, state) => sum + (counts[state] ?? 0), 0)
}

export async function getEmailQueueHealth() {
  if (!EmailQueue) {
    return {
      available: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    }
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    EmailQueue.getWaitingCount(),
    EmailQueue.getActiveCount(),
    EmailQueue.getCompletedCount(),
    EmailQueue.getFailedCount(),
    EmailQueue.getDelayedCount()
  ])

  return {
    available: true,
    waiting,
    active,
    completed,
    failed,
    delayed
  }
}

export async function closeEmailQueue(): Promise<void> {
  if (EmailQueue) {
    await EmailQueue.close()
  }
  if (EmailDeadLetterQueue) {
    await EmailDeadLetterQueue.close()
  }
  emailLogger.info('Email queue closed')
}
