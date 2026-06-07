import { Hono } from 'hono'

import {
  emailGateway,
  getEmailQueueConsumerHealth,
  startEmailQueueConsumer,
  stopEmailQueueConsumer
} from './lib/email'
import { workerLogger } from './lib/logger'
import { prisma, shutdownDatabase } from './lib/prisma'
import {
  getPushQueueConsumerHealth,
  pushGateway,
  startPushQueueConsumer,
  stopPushQueueConsumer
} from './lib/push'
import { createDocumentWorker } from './lib/queue'
import { disconnectRedis, getRedisClient, waitForRedisReady } from './lib/redis'

// =============================================================================
// Cleanup expired idempotency logs (runs every hour)
// =============================================================================
const CLEANUP_INTERVAL_MS = parseInt(process.env.IDEMPOTENCY_CLEANUP_INTERVAL_MS || '3600000', 10) // 1 hour

async function cleanupExpiredLogs() {
  try {
    const [emailResult, pushResult] = await Promise.all([
      prisma.emailSentLog.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      prisma.pushSentLog.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    ])

    if (emailResult.count > 0 || pushResult.count > 0) {
      workerLogger.info(
        { emailDeleted: emailResult.count, pushDeleted: pushResult.count },
        '🧹 Cleaned up expired idempotency logs'
      )
    }
  } catch (err) {
    workerLogger.warn({ err }, 'Failed to cleanup expired idempotency logs')
  }
}

// Schedule cleanup interval
let cleanupInterval: ReturnType<typeof setInterval> | null = null

const WORKER_HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '4002', 10)

// Validate Redis is available
const redis = getRedisClient()

if (!redis) {
  workerLogger.error('❌ Redis is required for queue worker. Set REDIS_HOST and REDIS_PORT.')
  process.exit(1)
}

// Wait for Redis to be actually ready
const isRedisReady = await waitForRedisReady(redis, 10000)
if (!isRedisReady) {
  workerLogger.error('❌ Redis connection timeout - failed to connect within 10s')
  process.exit(1)
}

workerLogger.info('✅ Redis connection established and ready')

// Start ALL BullMQ workers (document, email, push)
// This is the ONLY place workers should be created - not in rest-api
const documentWorker = createDocumentWorker()

workerLogger.info({
  msg: '🔧 BullMQ document worker started',
  concurrency: process.env.BULLMQ_CONCURRENCY || '5',
  rateLimit: {
    max: process.env.BULLMQ_RATE_LIMIT_MAX || '300',
    duration: process.env.BULLMQ_RATE_LIMIT_DURATION || '1000'
  }
})

// Initialize email gateway with worker mode (processes email jobs)
await emailGateway.initialize(true)
workerLogger.info('📧 Email gateway worker initialized')

// Initialize push gateway with worker mode (processes push jobs)
await pushGateway.initialize(true)
workerLogger.info('🔔 Push gateway worker initialized')

// Start pgmq consumers for notifications (polls Supabase queues)
// This is the new architecture - replaces pg_net HTTP calls for reliability
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

// Start idempotency log cleanup interval
cleanupInterval = setInterval(cleanupExpiredLogs, CLEANUP_INTERVAL_MS)
// Run once on startup to clean any stale logs
cleanupExpiredLogs()
workerLogger.info({ intervalMs: CLEANUP_INTERVAL_MS }, '🧹 Idempotency log cleanup scheduled')

// Create health check endpoint for worker
const healthApp = new Hono()

healthApp.get('/health', async (c) => {
  const docWorkerRunning = documentWorker.isRunning()
  const docWorkerPaused = documentWorker.isPaused()
  const emailHealth = await emailGateway.getHealth()
  const pushHealth = await pushGateway.getHealth()
  const pushConsumerHealth = getPushQueueConsumerHealth()
  const emailConsumerHealth = getEmailQueueConsumerHealth()

  const allHealthy =
    docWorkerRunning &&
    !docWorkerPaused &&
    pushConsumerHealth.running &&
    emailConsumerHealth.running

  return c.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    workers: {
      document: {
        running: docWorkerRunning,
        paused: docWorkerPaused,
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
      redis: redis ? 'connected' : 'disconnected',
      database: 'connected'
    }
  })
})

healthApp.get('/health/ready', async (c) => {
  const isReady = documentWorker.isRunning() && !documentWorker.isPaused()

  if (!isReady) {
    return c.json({ status: 'not ready' }, 503)
  }

  return c.json({ status: 'ready' })
})

// Start health check server
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

// Circuit breaker config (configurable via env for production tuning)
const ERROR_THRESHOLD = parseInt(process.env.WORKER_ERROR_THRESHOLD || '10', 10)
const ERROR_WINDOW_MS = parseInt(process.env.WORKER_ERROR_WINDOW_MS || '60000', 10)
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.WORKER_SHUTDOWN_TIMEOUT_MS || '120000', 10)

// Track error counts for circuit breaker pattern
let errorCount = 0
let lastErrorTime = 0

// Errors that should trigger immediate shutdown (unrecoverable)
const FATAL_ERRORS = ['EADDRINUSE', 'ERR_WORKER_OUT_OF_MEMORY', 'ENOMEM', 'FATAL']

const isFatalError = (err: Error | unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as any)?.code
  return FATAL_ERRORS.some((fatal) => message.includes(fatal) || code === fatal)
}

// Graceful shutdown - only called for fatal errors or SIGTERM/SIGINT
let isShuttingDown = false
const shutdown = async () => {
  if (isShuttingDown) return // Prevent double shutdown
  isShuttingDown = true

  workerLogger.info('🛑 Shutting down worker gracefully...')

  try {
    // Stop health server first to fail health checks
    healthServer.stop()

    // Stop cleanup interval
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }

    // Stop accepting new jobs on all workers
    await documentWorker.pause()
    workerLogger.info('Document worker paused')

    workerLogger.info({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Waiting for active jobs to complete...')

    const shutdownPromise = Promise.all([
      documentWorker.close(),
      emailGateway.shutdown(),
      pushGateway.shutdown(),
      stopPushQueueConsumer(),
      stopEmailQueueConsumer()
    ])

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
    )

    await Promise.race([shutdownPromise, timeoutPromise]).catch((err) => {
      workerLogger.warn({ err }, 'Timeout reached - forcing worker shutdown')
    })

    workerLogger.info('All workers closed')

    // Close connections
    await shutdownDatabase()
    await disconnectRedis()

    workerLogger.info('✅ Worker shutdown complete')
    process.exit(0)
  } catch (err) {
    workerLogger.error({ err }, '❌ Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Handle uncaught errors - DON'T exit for transient errors
process.on('uncaughtException', (err) => {
  workerLogger.error({ err }, '💥 Uncaught exception in worker')

  // Fatal errors = immediate shutdown
  if (isFatalError(err)) {
    workerLogger.error('Fatal error detected - shutting down')
    shutdown()
    return
  }

  // Circuit breaker with sliding window:
  // - Reset count if window expired (healthy period resets state)
  // - Shutdown only if too many errors within the window
  const now = Date.now()
  if (now - lastErrorTime > ERROR_WINDOW_MS) {
    errorCount = 1 // Start fresh window with this error
  } else {
    errorCount++
  }
  lastErrorTime = now

  if (errorCount >= ERROR_THRESHOLD) {
    workerLogger.error(
      { errorCount, windowMs: ERROR_WINDOW_MS },
      'Error threshold exceeded - shutting down'
    )
    shutdown()
    return
  }

  workerLogger.warn(
    { errorCount, threshold: ERROR_THRESHOLD, windowMs: ERROR_WINDOW_MS },
    'Non-fatal error - continuing (BullMQ will retry failed jobs)'
  )
})

process.on('unhandledRejection', (reason) => {
  workerLogger.error({ reason }, '💥 Unhandled rejection in worker')
  // Don't exit - BullMQ handles job retries internally
})

export { documentWorker, emailGateway, pushGateway }
