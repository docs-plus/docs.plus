/**
 * Push Notification Queue
 *
 * BullMQ-based queue for async push notification processing.
 * Provides rate limiting and retry logic.
 *
 * ARCHITECTURE NOTE:
 * - Queue operations (add jobs) run in rest-api containers
 * - Worker operations (process jobs) run ONLY in hocuspocus-worker container
 * - This prevents duplicate processing when rest-api scales to multiple replicas
 */

import { Queue, Worker } from 'bullmq'

import { config } from '../../config/env'
import type { PushDLQData, PushJobData } from '../../types/push.types'
import { toBullMQConnection } from '../../types/redis.types'
import { pushLogger } from '../logger'
import { prisma } from '../prisma'
import { createRedisConnection } from '../redis'
import { sendPushNotification } from './sender'

export const PUSH_QUEUE_NAME = 'push-notifications'

// BullMQ connection options (must set maxRetriesPerRequest: null)
const bullmqConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  commandTimeout: config.redis.commandTimeout,
  connectTimeout: config.redis.connectTimeout,
  keepAlive: config.redis.keepAlive
}

// Queue connection (for adding jobs - used by rest-api)
const redisClient = createRedisConnection(bullmqConnectionOptions)
const queueConnection = toBullMQConnection(redisClient)

if (!queueConnection) {
  pushLogger.warn('Redis not configured - push queue will not be available')
}

/**
 * Push Queue - handles outgoing push notifications
 */
const pushQueue = queueConnection
  ? new Queue<PushJobData>(PUSH_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600 // 24 hours
        },
        removeOnFail: false // Keep failed jobs - moved to DLQ manually
      }
    })
  : null

/**
 * Dead Letter Queue for permanently failed push notifications
 */
const pushDeadLetterQueue = queueConnection
  ? new Queue<PushDLQData>('push-notifications-dlq', {
      connection: queueConnection,
      defaultJobOptions: {
        removeOnComplete: {
          count: 200,
          age: 30 * 24 * 3600 // 30 days
        }
      }
    })
  : null

// Queue error handlers
pushQueue?.on('error', (err: Error) => {
  pushLogger.error({ err }, 'Push queue error')
})

pushDeadLetterQueue?.on('error', (err: Error) => {
  pushLogger.error({ err }, 'Push DLQ error')
})

let pushWorker: Worker<PushJobData> | null = null

/**
 * Queue a push notification for async processing
 */
export async function queuePush(data: PushJobData): Promise<string | null> {
  if (!pushQueue) return null

  try {
    const job = await pushQueue.add('send-push', data, {
      priority: 1 // High priority for push notifications
    })
    pushLogger.debug({ jobId: job.id }, 'Push notification queued')
    return job.id || null
  } catch (err) {
    pushLogger.error({ err }, 'Failed to queue push notification')
    return null
  }
}

/**
 * Create the push worker to process queue jobs
 *
 * IMPORTANT: This should only be called from hocuspocus-worker, NOT from rest-api.
 * BullMQ workers use blocking Redis commands (BRPOPLPUSH) and need dedicated connections.
 */
export function createPushWorker(): Worker<PushJobData> | null {
  if (pushWorker) return pushWorker

  // Worker needs DEDICATED connection (blocking commands)
  const workerRedis = createRedisConnection(bullmqConnectionOptions)
  const workerConnection = toBullMQConnection(workerRedis)
  if (!workerConnection) {
    pushLogger.error('Cannot create push worker - Redis not configured')
    return null
  }

  pushWorker = new Worker<PushJobData>(
    PUSH_QUEUE_NAME,
    async (job) => {
      const idempotencyKey = `push:${job.id}`

      pushLogger.debug({ jobId: job.id, type: job.data.type }, 'Processing push job')

      try {
        // ============================================================
        // IDEMPOTENCY CHECK: Prevent duplicate sends on retry
        // ============================================================
        const existingSend = await prisma.pushSentLog.findUnique({
          where: { idempotencyKey }
        })

        if (existingSend) {
          pushLogger.info(
            { jobId: job.id, subscriptionCount: existingSend.subscriptionCount },
            'Push already sent (idempotent skip)'
          )
          return {
            success: true,
            sent: existingSend.subscriptionCount,
            deduplicated: true
          }
        }

        // ============================================================
        // SEND PUSH NOTIFICATION
        // ============================================================
        if (job.data.type === 'notification') {
          const result = await sendPushNotification(job.data.payload)

          // ============================================================
          // RECORD SUCCESSFUL SEND (before returning)
          // ============================================================
          if (result.success) {
            const userId = job.data.payload.user_id || 'unknown'

            await prisma.pushSentLog
              .create({
                data: {
                  idempotencyKey,
                  userId: String(userId),
                  subscriptionCount: result.sent || 0
                }
              })
              .catch((recordErr: Error) => {
                // Log but don't fail - push was sent successfully
                pushLogger.warn(
                  { err: recordErr, jobId: job.id },
                  'Failed to record push send in idempotency log'
                )
              })
          }

          if (!result.success && result.error) {
            throw new Error(result.error)
          }
          return result
        }

        throw new Error(`Unknown push job type: ${job.data.type}`)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))

        // Move to DLQ on final attempt
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
          pushLogger.error({ jobId: job.id }, 'Push exhausted retries, moving to DLQ')

          const dlqData: PushDLQData = {
            ...job.data,
            originalJobId: job.id ?? undefined,
            failureReason: error.message,
            failedAt: new Date().toISOString()
          }
          await pushDeadLetterQueue?.add('failed-push', dlqData)
        }

        throw err // Re-throw to trigger retry
      }
    },
    {
      connection: workerConnection,
      concurrency: config.push.gateway.workerConcurrency,
      limiter: {
        max: config.push.gateway.rateLimitMax,
        duration: config.push.gateway.rateLimitDuration
      },
      // Lock settings for job ownership (prevents duplicate processing across workers)
      lockDuration: 30000, // 30s - push notifications are fast
      lockRenewTime: 10000, // 10s - renew lock
      stalledInterval: 15000, // Check every 15s
      maxStalledCount: 2 // 30s total before marking stalled
    }
  )

  pushWorker.on('completed', (job) => {
    pushLogger.debug({ jobId: job.id }, 'Push job completed')
  })

  pushWorker.on('failed', (job, err) => {
    pushLogger.error({ jobId: job?.id, err: err.message }, 'Push job failed')
  })

  pushLogger.info(
    {
      concurrency: config.push.gateway.workerConcurrency,
      rateLimit: {
        max: config.push.gateway.rateLimitMax,
        duration: config.push.gateway.rateLimitDuration
      }
    },
    'Push notification worker started'
  )

  return pushWorker
}

/**
 * Get push queue health status
 */
export async function getPushQueueHealth(): Promise<{
  available: boolean
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}> {
  if (!pushQueue) {
    return {
      available: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    }
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      pushQueue.getWaitingCount(),
      pushQueue.getActiveCount(),
      pushQueue.getCompletedCount(),
      pushQueue.getFailedCount(),
      pushQueue.getDelayedCount()
    ])

    return { available: true, waiting, active, completed, failed, delayed }
  } catch (err) {
    pushLogger.error({ err }, 'Failed to get push queue health')
    return {
      available: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    }
  }
}

/**
 * Close queue and worker connections
 */
export async function closePushQueue(): Promise<void> {
  if (pushWorker) {
    await pushWorker.close()
    pushWorker = null
  }
  if (pushQueue) {
    await pushQueue.close()
  }
  if (pushDeadLetterQueue) {
    await pushDeadLetterQueue.close()
  }
  pushLogger.info('Push queue closed')
}
