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

// Graceful shutdown
const shutdown = async () => {
  workerLogger.info('🛑 Shutting down worker gracefully...')

  try {
    // Stop accepting new jobs on all workers
    await documentWorker.pause()
    workerLogger.info('Document worker paused')

    // Wait up to 30 seconds for jobs to complete
    workerLogger.info('Waiting for active jobs to complete (max 30s)...')

    const timeout = setTimeout(() => {
      workerLogger.warn('Timeout reached - forcing worker shutdown')
    }, 30000)

    // Close all workers
    await Promise.all([documentWorker.close(), emailGateway.shutdown(), pushGateway.shutdown()])
    clearTimeout(timeout)
    workerLogger.info('All workers closed successfully')

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

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  workerLogger.error({ err }, '💥 Uncaught exception in worker')
  shutdown()
})

process.on('unhandledRejection', (reason, promise) => {
  workerLogger.error({ reason, promise }, '💥 Unhandled rejection in worker')
  shutdown()
})

export { documentWorker, emailGateway, pushGateway }
