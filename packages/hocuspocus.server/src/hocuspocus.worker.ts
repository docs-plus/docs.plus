import { createDocumentWorker } from './lib/queue'
import { emailGateway } from './lib/email'
import { pushGateway } from './lib/push'
import { workerLogger } from './lib/logger'
import { shutdownDatabase } from './lib/prisma'
import { getRedisClient, disconnectRedis, waitForRedisReady } from './lib/redis'
import { Hono } from 'hono'

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

// Create health check endpoint for worker
const healthApp = new Hono()

healthApp.get('/health', async (c) => {
  const docWorkerRunning = documentWorker.isRunning()
  const docWorkerPaused = documentWorker.isPaused()
  const emailHealth = await emailGateway.getHealth()
  const pushHealth = await pushGateway.getHealth()

  const allHealthy = docWorkerRunning && !docWorkerPaused

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
        configured: pushHealth.configured
      }
    },
    services: {
      redis: redis ? 'connected' : 'disconnected',
      database: 'connected' // Prisma validates on startup
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

    // Stop accepting new jobs on all workers
    await documentWorker.pause()
    workerLogger.info('Document worker paused')

    workerLogger.info({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Waiting for active jobs to complete...')

    const shutdownPromise = Promise.all([
      documentWorker.close(),
      emailGateway.shutdown(),
      pushGateway.shutdown()
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
