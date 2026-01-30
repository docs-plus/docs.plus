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
import type { PushJobData } from '../../types/push.types'
import { pushLogger } from '../logger'
import { createRedisConnection } from '../redis'
import { sendPushNotification } from './sender'

export const PUSH_QUEUE_NAME = 'push-notifications'

// BullMQ connection options (must set maxRetriesPerRequest: null)
const bullmqConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '60000', 10),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10),
  keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10)
}

// Queue connection (for adding jobs - used by rest-api)
const queueConnection = createRedisConnection(bullmqConnectionOptions)

if (!queueConnection) {
  pushLogger.warn('Redis not configured - push queue will not be available')
}

/**
 * Push Queue - handles outgoing push notifications
 */
const pushQueue = queueConnection
  ? new Queue<PushJobData>(PUSH_QUEUE_NAME, {
      // Cast to any to avoid ioredis version mismatch in node_modules
      connection: queueConnection as any,
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
        removeOnFail: {
          count: 50,
          age: 7 * 24 * 3600 // 7 days
        }
      }
    })
  : null

// Queue error handler
pushQueue?.on('error', (err: Error) => {
  pushLogger.error({ err }, 'Push queue error')
})

let pushWorker: Worker<PushJobData> | null = null

/**
 * Queue a push notification for async processing
 */
export async function queuePush(data: PushJobData): Promise<string | null> {
  if (!pushQueue) return null

  try {
    const job = await pushQueue.add('send-push' as any, data, {
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
  const workerConnection = createRedisConnection(bullmqConnectionOptions)
  if (!workerConnection) {
    pushLogger.error('Cannot create push worker - Redis not configured')
    return null
  }

  pushWorker = new Worker<PushJobData>(
    PUSH_QUEUE_NAME,
    async (job) => {
      pushLogger.debug({ jobId: job.id, type: job.data.type }, 'Processing push job')

      if (job.data.type === 'notification') {
        const result = await sendPushNotification(job.data.payload)
        if (!result.success && result.error) {
          throw new Error(result.error)
        }
        return result
      }

      throw new Error(`Unknown push job type: ${job.data.type}`)
    },
    {
      // Cast to any to avoid ioredis version mismatch in node_modules
      connection: workerConnection as any,
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
  pushLogger.info('Push queue closed')
}
