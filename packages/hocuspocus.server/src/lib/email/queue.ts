/**
 * Email Queue
 *
 * BullMQ-based queue for reliable email delivery.
 * Handles retries, rate limiting, and dead letter queue.
 */

import { Job, Queue, Worker } from 'bullmq'

import { config } from '../../config/env'
import type { EmailDLQData, EmailJobData, EmailResult } from '../../types/email.types'
import { toBullMQConnection } from '../../types/redis.types'
import { emailLogger } from '../logger'
import { prisma } from '../prisma'
import { createRedisConnection } from '../redis'
import { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'

// BullMQ connection options
const bullmqConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  commandTimeout: config.redis.commandTimeout,
  connectTimeout: config.redis.connectTimeout,
  keepAlive: config.redis.keepAlive
}

// Queue connection
const redisClient = createRedisConnection(bullmqConnectionOptions)
const queueConnection = toBullMQConnection(redisClient)

if (!queueConnection) {
  emailLogger.warn('Redis not configured - email queue will not be available')
}

/**
 * Email Queue
 * Handles all outgoing emails with retry logic
 */
export const EmailQueue = queueConnection
  ? new Queue<EmailJobData>('email-notifications', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000 // Start with 5s delay
        },
        removeOnComplete: {
          count: 500,
          age: 24 * 3600 // 24 hours
        },
        removeOnFail: false // Keep failed jobs for investigation
      }
    })
  : null

/**
 * Dead Letter Queue for permanently failed emails
 */
export const EmailDeadLetterQueue = queueConnection
  ? new Queue<EmailDLQData>('email-notifications-dlq', {
      connection: queueConnection,
      defaultJobOptions: {
        removeOnComplete: {
          count: 200,
          age: 30 * 24 * 3600 // 30 days
        }
      }
    })
  : null

// Queue error handler
EmailQueue?.on('error', (err: Error) => {
  emailLogger.error({ err }, 'Email queue error')
})

/**
 * Create email worker for processing jobs
 */
export function createEmailWorker() {
  if (!queueConnection) {
    emailLogger.warn('Cannot create email worker - Redis not configured')
    return null
  }

  // Worker needs dedicated connection (uses blocking commands)
  const workerRedis = createRedisConnection(bullmqConnectionOptions)
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
        // ============================================================
        // IDEMPOTENCY CHECK: Prevent duplicate sends on retry
        // ============================================================
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

        // ============================================================
        // SEND EMAIL
        // ============================================================
        const result = await sendEmailViaProvider(data)

        // ============================================================
        // RECORD SUCCESSFUL SEND (before returning)
        // ============================================================
        if (result.success) {
          // Get recipient (all email types have 'to')
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

        // Update Supabase email_queue status
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

        // Move to DLQ on final attempt
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
          emailLogger.error({ jobId: job.id }, 'Email exhausted retries, moving to DLQ')

          const dlqData: EmailDLQData = {
            ...data,
            originalJobId: job.id ?? undefined,
            failureReason: error.message,
            failedAt: new Date().toISOString()
          }
          await EmailDeadLetterQueue?.add('failed-email', dlqData)

          // Update Supabase with permanent failure
          if (data.type === 'notification' && 'queue_id' in data.payload) {
            await updateSupabaseEmailStatus({
              queue_id: data.payload.queue_id,
              status: 'failed',
              error_message: `Permanent failure after ${job.attemptsMade} attempts: ${error.message}`
            })
          }
        }

        throw err // Re-throw to trigger retry
      }
    },
    {
      connection: workerConnection,
      concurrency: config.email.gateway.workerConcurrency,
      limiter: {
        max: config.email.gateway.rateLimitMax,
        duration: config.email.gateway.rateLimitDuration
      },
      // Lock settings for job ownership (prevents duplicate processing across workers)
      lockDuration: 60000, // 1 min - email sending typically fast
      lockRenewTime: 15000, // 15s - renew lock
      stalledInterval: 30000, // Check every 30s
      maxStalledCount: 2 // 1 min total before marking stalled
    }
  )

  // Worker event handlers
  worker.on('completed', (job) => {
    emailLogger.debug({ jobId: job.id }, 'Email job completed')
  })

  worker.on('failed', (job, err) => {
    if (job) {
      emailLogger.error({ jobId: job.id, err, attempts: job.attemptsMade }, 'Email job failed')
    }
  })

  worker.on('error', (err) => {
    emailLogger.error({ err }, 'Email worker error')
  })

  emailLogger.info('Email worker started')

  return worker
}

/**
 * Add email job to queue
 */
export async function queueEmail(data: EmailJobData): Promise<string | null> {
  if (!EmailQueue) {
    emailLogger.warn('Email queue not available - sending synchronously')
    // Fallback to synchronous sending
    const result = await sendEmailViaProvider(data)
    return result.success ? 'sync-send' : null
  }

  const job = await EmailQueue.add('send-email', data, {
    priority: data.type === 'notification' ? 1 : 2 // Notifications have higher priority
  })

  emailLogger.debug({ jobId: job.id, type: data.type }, 'Email queued')

  return job.id || null
}

/**
 * Get queue health stats
 */
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

/**
 * Close queue connections
 */
export async function closeEmailQueue(): Promise<void> {
  if (EmailQueue) {
    await EmailQueue.close()
  }
  if (EmailDeadLetterQueue) {
    await EmailDeadLetterQueue.close()
  }
  emailLogger.info('Email queue closed')
}
