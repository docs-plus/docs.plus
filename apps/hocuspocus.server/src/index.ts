import './lib/instrument'

import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import emailRouter from './api/email'
import adminRouter from './api/routers/admin.router'
import documentsRouter from './api/routers/documents.router'
import healthRouter from './api/routers/health.router'
import hypermultimediaRouter from './api/routers/hypermultimedia.router'
import { config } from './config/env' // import runs env validation (fail-fast at boot)
import { emailGateway } from './lib/email'
import { AppError, getErrorResponse } from './lib/errors'
import { captureHttpError, captureUnknown, flushObservability } from './lib/instrument'
import { logger, restApiLogger } from './lib/logger'
import { httpMetricsMiddleware, metricsContentType, metricsText } from './lib/metrics'
import { prisma, shutdownDatabase } from './lib/prisma'
import { pushGateway } from './lib/push'
import { disconnectRedis, getRedisClient } from './lib/redis'
import { setupMiddleware } from './middleware'
import * as linkMetadata from './modules/link-metadata'

// Create Hono app
const app = new Hono()

// Record latency + count per matched route on the shared Prometheus registry.
// Outermost so it also sees responses the rate limiter short-circuits (429s).
app.use('*', httpMetricsMiddleware())

// Setup middleware
setupMiddleware(app)

// Inject dependencies into context (lazy load Redis on request)
app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  c.set('redis', getRedisClient())
  await next()
})

// Routes
app.get('/', (c) => {
  return c.json({ message: 'Hello World!' })
})

// Prometheus exposition — internal only: bound to port 4000 and Traefik routes
// just /api and /health, so this is unreachable from the public edge.
app.get('/metrics', async (c) => {
  c.header('Content-Type', metricsContentType)
  return c.body(await metricsText())
})

// Mount routers
app.route('/health', healthRouter)
app.route('/api/documents', documentsRouter)
app.route('/api/plugins/hypermultimedia', hypermultimediaRouter)
app.route('/api/email', emailRouter)
// NOTE: /api/push endpoint removed - push notifications now use pgmq Consumer architecture
// See: docs/PUSH_NOTIFICATION_PGMQ.md
app.route('/api/admin', adminRouter)
const linkMetadataModule = linkMetadata.init({
  redis: getRedisClient(),
  logger: logger.child({ module: 'link-metadata' })
})
app.route('/api/metadata', linkMetadataModule.router)

// Single error contract: map AppError → status, redact unknown errors, one envelope.
app.notFound((c) =>
  c.json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } }, 404)
)
app.onError((err, c) => {
  restApiLogger.error({ err, method: c.req.method, path: c.req.path }, 'Unhandled request error')
  captureHttpError(err)
  const status = (err instanceof AppError ? err.statusCode : 500) as ContentfulStatusCode
  return c.json(getErrorResponse(err instanceof Error ? err : new Error(String(err))), status)
})

// Initialize gateways (queue-only mode - workers run in hocuspocus-worker)
// This allows rest-api to scale to multiple replicas without duplicate workers
emailGateway.initialize(false).catch((err) => {
  restApiLogger.error({ err }, 'Failed to initialize email gateway')
  captureUnknown(err)
})

pushGateway.initialize(false).catch((err) => {
  restApiLogger.error({ err }, 'Failed to initialize push gateway')
  captureUnknown(err)
})

// Start server
const server = Bun.serve({
  fetch: app.fetch,
  port: config.app.port,
  hostname: '0.0.0.0'
})

// Log server startup
restApiLogger.info({
  msg: '🚀 REST API Server started successfully',
  port: server.port,
  environment: config.app.env,
  url: `http://localhost:${server.port}`,
  config: {
    hocuspocus_logger: config.hocuspocus.logger.enabled,
    hocuspocus_throttle: config.hocuspocus.throttle.enabled,
    database: config.database.url ? 'configured' : 'not set',
    redis: getRedisClient() ? 'connected' : 'disabled'
  }
})

// Graceful shutdown
const shutdown = async () => {
  restApiLogger.info('Shutting down REST API gracefully...')

  try {
    // Close server first to stop accepting new requests
    server.stop()

    // Cleanup connections
    await emailGateway.shutdown()
    await pushGateway.shutdown()
    await shutdownDatabase()
    await disconnectRedis()

    restApiLogger.info('✅ REST API shutdown complete')
    await flushObservability()
    process.exit(0)
  } catch (err) {
    restApiLogger.error({ err }, '❌ Error during shutdown')
    captureUnknown(err)
    await flushObservability()
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

process.on('unhandledRejection', (reason) => {
  restApiLogger.error({ err: reason }, 'Unhandled promise rejection')
  captureUnknown(reason)
})
process.on('uncaughtException', (err) => {
  restApiLogger.error({ err }, 'Uncaught exception — shutting down')
  captureUnknown(err)
  void shutdown()
})

export default app
