import './lib/instrument'

import { Hono } from 'hono'

import { purgeDocumentFootprint } from './api/services/documentPurge.service'
import { config } from './config/env'
import {
  emailGateway,
  getEmailQueueConsumerHealth,
  startEmailQueueConsumer,
  stopEmailQueueConsumer
} from './lib/email'
import { captureUnknown, flushObservability } from './lib/instrument'
import { workerLogger } from './lib/logger'
import { metricsContentType, metricsText } from './lib/metrics'
import { checkDatabaseHealth, prisma, shutdownDatabase } from './lib/prisma'
import {
  getPushQueueConsumerHealth,
  pushGateway,
  startPushQueueConsumer,
  stopPushQueueConsumer
} from './lib/push'
import { closeQueues, createDocumentWorker, getStoreQueueOldestWaitingAgeMs } from './lib/queue'
import { checkRedisHealth, disconnectRedis, getRedisClient, waitForRedisReady } from './lib/redis'
import { createRetention } from './lib/retention'
import { getServiceRoleClient } from './lib/supabase'
import { startWorkerMetricsSampling } from './lib/workerMetricsSampler'

const CLEANUP_INTERVAL_MS = config.worker.idempotencyCleanupIntervalMs

// The entry point schedules; the rules live in lib/retention so a test can
// reach them without booting a worker.
const supabaseForPurge = getServiceRoleClient()
const retention = createRetention({
  prisma,
  purge: supabaseForPurge
    ? (target) => purgeDocumentFootprint(prisma, supabaseForPurge, target)
    : null,
  logger: workerLogger,
  autosaveRetentionDays: config.worker.autosaveRetentionDays,
  deleteRetentionDays: config.worker.deleteRetentionDays
})

let cleanupInterval: ReturnType<typeof setInterval> | null = null

const WORKER_HEALTH_PORT = config.worker.healthPort

const redis = getRedisClient()

if (!redis) {
  workerLogger.error('❌ Redis is required for queue worker. Set REDIS_HOST and REDIS_PORT.')
  captureUnknown(new Error('Worker startup failed: Redis client unavailable'))
  await flushObservability()
  process.exit(1)
}

const isRedisReady = await waitForRedisReady(redis, 10000)
if (!isRedisReady) {
  workerLogger.error('❌ Redis connection timeout - failed to connect within 10s')
  captureUnknown(new Error('Worker startup failed: Redis connection timeout'))
  await flushObservability()
  process.exit(1)
}

workerLogger.info('✅ Redis connection established and ready')

// This is the ONLY place workers should be created - not in rest-api
const documentWorker = createDocumentWorker()

workerLogger.info({
  msg: '🔧 BullMQ document worker started',
  concurrency: config.bullmq.concurrency,
  rateLimit: {
    max: config.bullmq.rateLimitMax,
    duration: config.bullmq.rateLimitDuration
  }
})

await emailGateway.initialize(true)
workerLogger.info('📧 Email gateway worker initialized')

await pushGateway.initialize(true)
workerLogger.info('🔔 Push gateway worker initialized')

const pushConsumerStarted = startPushQueueConsumer()
const emailConsumerStarted = startEmailQueueConsumer()

if (pushConsumerStarted) {
  workerLogger.info('📬 Push notification pgmq consumer started (polling every 2s)')
} else {
  workerLogger.warn('⚠️ Push notification pgmq consumer not started - check Supabase config')
}

if (emailConsumerStarted) {
  workerLogger.info('📧 Email notification pgmq consumer started (polling every 2s)')
} else {
  workerLogger.warn('⚠️ Email notification pgmq consumer not started - check Supabase config')
}

cleanupInterval = setInterval(() => retention.run(), CLEANUP_INTERVAL_MS)
// Run once on startup to clean any stale rows
retention.run()
workerLogger.info(
  {
    intervalMs: CLEANUP_INTERVAL_MS,
    autosaveRetentionDays: config.worker.autosaveRetentionDays,
    deleteRetentionDays: config.worker.deleteRetentionDays
  },
  '🧹 Idempotency log + autosave version + soft-delete reaper cleanup scheduled'
)

const stopWorkerMetricsSampling = startWorkerMetricsSampling()

const healthApp = new Hono()

// isRunning()/isPaused() are flags that stay green while BullMQ's fetch loop
// is parked on a dead blocking connection (2026-07-14 outage). Oldest-waiting
// age is the signal that actually tests dequeue-liveness. The 120s is 12x the
// 10s store debounce; retries back off in `delayed`, so they cannot trip this.
const STORE_QUEUE_MAX_WAIT_AGE_MS = 120_000

healthApp.get('/health', async (c) => {
  const docWorkerRunning = documentWorker.isRunning()
  const docWorkerPaused = documentWorker.isPaused()
  const emailHealth = await emailGateway.getHealth()
  const pushHealth = await pushGateway.getHealth()
  const pushConsumerHealth = getPushQueueConsumerHealth()
  const emailConsumerHealth = getEmailQueueConsumerHealth()

  const [dbHealthy, redisHealthy, storeQueueOldestWaitingAgeMs] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    // undefined = probe failed; we cannot assert dequeue-liveness → unhealthy.
    getStoreQueueOldestWaitingAgeMs().catch(() => undefined)
  ])
  const storeQueueLive =
    storeQueueOldestWaitingAgeMs !== undefined &&
    (storeQueueOldestWaitingAgeMs === null ||
      storeQueueOldestWaitingAgeMs < STORE_QUEUE_MAX_WAIT_AGE_MS)

  const allHealthy =
    docWorkerRunning &&
    !docWorkerPaused &&
    storeQueueLive &&
    pushConsumerHealth.running &&
    emailConsumerHealth.running &&
    dbHealthy &&
    redisHealthy

  return c.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    workers: {
      document: {
        running: docWorkerRunning,
        paused: docWorkerPaused,
        queueLive: storeQueueLive,
        oldestWaitingAgeMs: storeQueueOldestWaitingAgeMs ?? null,
        name: documentWorker.name
      },
      email: {
        pending: emailHealth.pending_jobs,
        failed: emailHealth.failed_jobs,
        provider: emailHealth.provider
      },
      push: {
        pending: pushHealth.pending_jobs,
        failed: pushHealth.failed_jobs,
        vapid_configured: pushHealth.vapid_configured
      }
    },
    pgmq_consumers: {
      push: {
        running: pushConsumerHealth.running,
        messagesProcessed: pushConsumerHealth.metrics.messagesProcessed,
        messagesFailed: pushConsumerHealth.metrics.messagesFailed,
        lastPollAt: pushConsumerHealth.metrics.lastPollAt
      },
      email: {
        running: emailConsumerHealth.running,
        messagesProcessed: emailConsumerHealth.metrics.messagesProcessed,
        messagesFailed: emailConsumerHealth.metrics.messagesFailed,
        lastPollAt: emailConsumerHealth.metrics.lastPollAt
      }
    },
    services: {
      redis: redisHealthy ? 'connected' : 'disconnected',
      database: dbHealthy ? 'connected' : 'disconnected'
    }
  })
})

// Prometheus scrape target; internal-only, served on the worker health port.
healthApp.get('/metrics', async (c) => {
  return c.body(await metricsText(), 200, { 'Content-Type': metricsContentType })
})

healthApp.get('/health/ready', async (c) => {
  const isReady = documentWorker.isRunning() && !documentWorker.isPaused()

  if (!isReady) {
    return c.json({ status: 'not ready' }, 503)
  }

  return c.json({ status: 'ready' })
})

const healthServer = Bun.serve({
  fetch: healthApp.fetch,
  port: WORKER_HEALTH_PORT,
  hostname: '0.0.0.0'
})

workerLogger.info({
  msg: '💚 Worker health check server started',
  port: healthServer.port,
  url: `http://localhost:${healthServer.port}/health`
})

const ERROR_THRESHOLD = config.worker.errorThreshold
const ERROR_WINDOW_MS = config.worker.errorWindowMs
const SHUTDOWN_TIMEOUT_MS = config.worker.shutdownTimeoutMs

let errorCount = 0
let lastErrorTime = 0

const FATAL_ERRORS = ['EADDRINUSE', 'ERR_WORKER_OUT_OF_MEMORY', 'ENOMEM', 'FATAL']

const isFatalError = (err: Error | unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as any)?.code
  return FATAL_ERRORS.some((fatal) => message.includes(fatal) || code === fatal)
}

let isShuttingDown = false
// exitCode is 1 on a crash — a fatal error or a breached error threshold. Both
// paths drained cleanly and then exited 0, so BullMQ job loss looked like a
// normal stop to Docker's restart policy and to --kill-others-on-fail.
const shutdown = async (exitCode = 0) => {
  if (isShuttingDown) return
  isShuttingDown = true

  workerLogger.info('🛑 Shutting down worker gracefully...')

  try {
    // Stop health server first to fail health checks
    healthServer.stop()

    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }

    stopWorkerMetricsSampling()

    await documentWorker.pause()
    workerLogger.info('Document worker paused')

    workerLogger.info({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Waiting for active jobs to complete...')

    const shutdownPromise = (async () => {
      // Drain the pgmq consumers FIRST: an in-flight poll enqueues onto the
      // email/push BullMQ queues, so closing those concurrently would risk an
      // add-after-close. Once the consumers stop, tear down the rest.
      await Promise.all([stopPushQueueConsumer(), stopEmailQueueConsumer()])
      await Promise.all([
        documentWorker.close(),
        closeQueues(),
        emailGateway.shutdown(),
        pushGateway.shutdown()
      ])
    })()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
    )

    await Promise.race([shutdownPromise, timeoutPromise]).catch((err) => {
      workerLogger.warn({ err }, 'Timeout reached - forcing worker shutdown')
    })

    workerLogger.info('All workers closed')

    await shutdownDatabase()
    await disconnectRedis()

    workerLogger.info('✅ Worker shutdown complete')
    await flushObservability()
    process.exit(exitCode)
  } catch (err) {
    workerLogger.error({ err }, '❌ Error during shutdown')
    captureUnknown(err)
    await flushObservability()
    process.exit(1)
  }
}

// Wrapped: a bare handler receives the signal name, which would land in exitCode.
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

// Don't exit for transient errors
process.on('uncaughtException', (err) => {
  workerLogger.error({ err }, '💥 Uncaught exception in worker')
  captureUnknown(err)

  if (isFatalError(err)) {
    workerLogger.error('Fatal error detected - shutting down')
    void shutdown(1)
    return
  }

  const now = Date.now()
  if (now - lastErrorTime > ERROR_WINDOW_MS) {
    errorCount = 1
  } else {
    errorCount++
  }
  lastErrorTime = now

  if (errorCount >= ERROR_THRESHOLD) {
    workerLogger.error(
      { errorCount, windowMs: ERROR_WINDOW_MS },
      'Error threshold exceeded - shutting down'
    )
    void shutdown(1)
    return
  }

  workerLogger.warn(
    { errorCount, threshold: ERROR_THRESHOLD, windowMs: ERROR_WINDOW_MS },
    'Non-fatal error - continuing (BullMQ will retry failed jobs)'
  )
})

process.on('unhandledRejection', (reason) => {
  workerLogger.error({ reason }, '💥 Unhandled rejection in worker')
  captureUnknown(reason)
  // Don't exit - BullMQ handles job retries internally
})

export { documentWorker, emailGateway, pushGateway }
