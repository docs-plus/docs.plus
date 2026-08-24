import { Job, Queue, Worker } from 'bullmq'

import { config } from '../../config/env'
import type { EmailDLQData, EmailJobData, EmailResult } from '../../types/email.types'
import { toBullMQConnection } from '../../types/redis.types'
import { captureUnknown } from '../instrument'
import { emailLogger } from '../logger'
import { recordJobOutcome } from '../metrics'
import { prisma } from '../prisma'
import {
  bullmqConnectionOptions,
  bullmqWorkerConnectionOptions,
  createRedisConnection
} from '../redis'
import { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'

const redisClient = createRedisConnection(bullmqConnectionOptions)
const queueConnection = toBullMQConnection(redisClient)

if (!queueConnection) {
  emailLogger.warn('Redis not configured - email queue will not be available')
}

export const EmailQueue = queueConnection
  ? new Queue<EmailJobData>('email-notifications', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
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
  ? new Queue<EmailDLQData>('email-notifications-dlq', {
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
    'email-notifications',
    async (job: Job<EmailJobData>): Promise<EmailResult> => {
      const { data } = job
      const startTime = Date.now()
      const idempotencyKey = `email:${job.id}`

      emailLogger.info({ jobId: job.id, type: data.type }, 'Processing email job')

      try {
        const existingSend = await prisma.emailSentLog.findUnique({
          where: { idempotencyKey }
        })

        if (existingSend) {
          emailLogger.info(
            { jobId: job.id, originalMessageId: existingSend.messageId },
            'Email already sent (idempotent skip)'
          )
          return {
            success: true,
            message_id: existingSend.messageId || undefined,
            deduplicated: true
          }
        }

        const result = await sendEmailViaProvider(data)

        // Record the successful send before returning so a retry dedupes
        if (result.success) {
          const recipient = Array.isArray(data.payload.to)
            ? data.payload.to[0] || 'unknown'
            : data.payload.to

          await prisma.emailSentLog
            .create({
              data: {
                idempotencyKey,
                messageId: result.message_id || null,
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
        }

        if (data.type === 'notification' && 'queue_id' in data.payload) {
          await updateSupabaseEmailStatus({
            queue_id: data.payload.queue_id,
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : undefined,
            error_message: result.error
          })
        }

        const duration = Date.now() - startTime
        emailLogger.info(
          { jobId: job.id, duration: `${duration}ms`, success: result.success },
          'Email job completed'
        )

        if (!result.success) {
          throw new Error(result.error || 'Failed to send email')
        }

        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        emailLogger.error({ err: error, jobId: job.id }, 'Email job failed')

        // Move to DLQ on final attempt (+1: attemptsMade counts prior
        // attempts inside the processor — BullMQ increments after the throw)
        if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
          emailLogger.error({ jobId: job.id }, 'Email exhausted retries, moving to DLQ')
          captureUnknown(error)

          const dlqData: EmailDLQData = {
            ...data,
            originalJobId: job.id ?? undefined,
            failureReason: error.message,
            failedAt: new Date().toISOString()
          }
          await EmailDeadLetterQueue?.add('failed-email', dlqData)

          if (data.type === 'notification' && 'queue_id' in data.payload) {
            await updateSupabaseEmailStatus({
              queue_id: data.payload.queue_id,
              status: 'failed',
              error_message: `Permanent failure after ${job.attemptsMade} attempts: ${error.message}`
            })
          }
        }

        throw err
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

  worker.on('failed', (job, err) => {
    recordJobOutcome(worker.name, 'failed')
    if (job) {
      emailLogger.error({ jobId: job.id, err, attempts: job.attemptsMade }, 'Email job failed')
    }
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
 * instead of a duplicate; the worker's `email:${job.id}` key follows it.
 */
export async function queueEmail(data: EmailJobData, jobId?: string): Promise<string | null> {
  if (!EmailQueue) {
    emailLogger.warn('Email queue not available - sending synchronously')
    const result = await sendEmailViaProvider(data)
    return result.success ? 'sync-send' : null
  }

  const job = await EmailQueue.add('send-email', data, {
    priority: data.type === 'notification' ? 1 : 2,
    ...(jobId ? { jobId } : {})
  })

  emailLogger.debug({ jobId: job.id, type: data.type }, 'Email queued')

  return job.id || null
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
