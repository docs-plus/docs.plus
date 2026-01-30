/**
 * Email Queue
 *
 * BullMQ-based queue for reliable email delivery.
 * Handles retries, rate limiting, and dead letter queue.
 */

import { Job,Queue, Worker } from 'bullmq'

import type { EmailJobData, EmailResult } from '../../types/email.types'
import { emailLogger } from '../logger'
import { createRedisConnection } from '../redis'
import { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'

// BullMQ connection options
const bullmqConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '60000', 10),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10),
  keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10)
}

// Queue connection
const queueConnection = createRedisConnection(bullmqConnectionOptions)

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
  ? new Queue<EmailJobData>('email-notifications-dlq', {
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
  const workerConnection = createRedisConnection(bullmqConnectionOptions)

  if (!workerConnection) {
    emailLogger.error('Failed to create worker Redis connection')
    return null
  }

  const worker = new Worker<EmailJobData>(
    'email-notifications',
    async (job: Job<EmailJobData>): Promise<EmailResult> => {
      const { data } = job
      const startTime = Date.now()

      emailLogger.info({ jobId: job.id, type: data.type }, 'Processing email job')

      try {
        const result = await sendEmailViaProvider(data)

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

          await EmailDeadLetterQueue?.add('failed-email', {
            ...data,
            originalJobId: job.id,
            failureReason: error.message,
            failedAt: new Date().toISOString()
          } as any)

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
      concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '3', 10),
      limiter: {
        max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX || '50', 10),
        duration: parseInt(process.env.EMAIL_RATE_LIMIT_DURATION || '60000', 10) // 50 per minute
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
