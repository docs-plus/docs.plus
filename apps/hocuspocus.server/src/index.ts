import './lib/instrument'

import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import pkg from '../package.json'
import emailRouter from './api/email'
import adminRouter from './api/routers/admin.router'
import documentsRouter from './api/routers/documents.router'
import healthRouter from './api/routers/health.router'
import hypermultimediaRouter from './api/routers/hypermultimedia.router'
import { getOwnerProfiles } from './api/services/documents.service'
import { config } from './config/env' // import runs env validation (fail-fast at boot)
import { verifyServiceRole } from './lib/auth'
import { emailGateway } from './lib/email'
import { AppError, getErrorResponse } from './lib/errors'
import { captureHttpError, captureUnknown, flushObservability } from './lib/instrument'
import { logger, restApiLogger } from './lib/logger'
import { httpMetricsMiddleware, metricsContentType, metricsText } from './lib/metrics'
import { prisma, shutdownDatabase } from './lib/prisma'
import { pushGateway } from './lib/push'
import { disconnectRedis, getRedisClient } from './lib/redis'
import { setupMiddleware } from './middleware'
import * as documentContent from './modules/document-content'
import * as documentConversion from './modules/document-conversion'
import * as documentVersions from './modules/document-versions'
import * as linkMetadata from './modules/link-metadata'
import * as openapi from './modules/openapi'

// Create Hono app
const app = new Hono()

// Correlation id first so every log line and error capture can carry it.
app.use('*', requestId())

// Record latency + count per matched route on the shared Prometheus registry.
// Outermost so it also sees responses the rate limiter short-circuits (429s).
app.use('*', httpMetricsMiddleware())

// OpenAPI 3.1 spec + Swagger UI. Built eagerly so a malformed document fails at
// boot, not on first request. A relative server URL keeps Try-it-out on
// whichever origin served the page.
const openapiModule = openapi.init({
  servers: [{ url: '/', description: 'This server' }],
  version: pkg.version
})
// Swagger UI loads from a CDN, so its page needs a widened CSP. Registered
// above setupMiddleware because secureHeaders rewrites the header after next().
app.use(openapi.DOCS_PATH, openapi.swaggerUiCsp)

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
// Mounted after the legacy documents router. Content routes are two-segment, so
// they cannot be shadowed by its single-segment `/:docName` read.
const documentContentModule = documentContent.init({
  prisma,
  logger: logger.child({ module: 'document-content' }),
  verifyServiceRole,
  serviceRoleKey: config.supabase.serviceRoleKey ?? null,
  wsApplyBaseUrl: config.hocuspocus.internalUrl
})
app.route('/api/documents', documentContentModule.router)
// Reads are served straight from Prisma here; checkpoints and restores are
// forwarded to the collaboration process, which owns the live Y.Doc.
const documentVersionsModule = documentVersions.init({
  prisma,
  logger: logger.child({ module: 'document-versions' }),
  verifyServiceRole,
  serviceRoleKey: config.supabase.serviceRoleKey ?? null,
  wsOpsBaseUrl: config.hocuspocus.internalUrl,
  getOwnerProfiles
})
app.route('/api/documents', documentVersionsModule.router)
const documentConversionModule = documentConversion.init({
  prisma,
  logger: logger.child({ module: 'document-conversion' }),
  // `PUBLIC_RESTAPI_URL`, never a request header: this is persisted into document
  // content, and `X-Forwarded-Host` is client-settable. Unset drops imported
  // images with a warning rather than storing an origin nobody can resolve.
  mediaPublicBaseUrl: config.app.publicUrl
})
app.route('/api/documents', documentConversionModule.router)
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
// Absolute paths (/openapi.json, /docs), so this mounts at the root.
app.route('/', openapiModule.router)

// Single error contract: map AppError → status, redact unknown errors, one envelope.
app.notFound((c) =>
  c.json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } }, 404)
)
app.onError((err, c) => {
  const context = { requestId: c.get('requestId'), method: c.req.method, path: c.req.path }
  restApiLogger.error({ err, ...context }, 'Unhandled request error')
  const userId = c.get('userId') ?? c.get('user')?.sub
  captureHttpError(err, { extra: context, ...(userId ? { user: { id: userId } } : {}) })
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

// Start server. Bun's 10 s default closed the socket mid-duplicate while the
// handler ran on, so a slow copy reported failure over a copy that completed and
// a retry stacked a second one. 60 s covers the bounded media copy a duplicate
// does — the objects its snapshot names, sequentially, inside the request.
const server = Bun.serve({
  fetch: app.fetch,
  port: config.app.port,
  hostname: '0.0.0.0',
  idleTimeout: 60
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
