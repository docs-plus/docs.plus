import { Hono } from 'hono'
import { prisma, shutdownDatabase } from './lib/prisma'
import { getRedisClient, disconnectRedis } from './lib/redis'
import { setupMiddleware } from './middleware'
import { restApiLogger } from './lib/logger'
import healthRouter from './api/health'
import documentsRouter from './api/documents'
import hypermultimediaRouter from './api/hypermultimedia'
import emailRouter from './api/email'
import pushRouter from './api/push'
import adminRouter from './api/admin'
import { emailGateway } from './lib/email'
import { pushGateway } from './lib/push'
import { checkEnvBolean } from './utils'

const {
  APP_PORT = '4000',
  NODE_ENV,
  HOCUSPOCUS_LOGGER,
  HOCUSPOCUS_THROTTLE,
  DATABASE_URL
} = process.env

// Create Hono app
const app = new Hono()

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

// Mount routers
app.route('/health', healthRouter)
app.route('/api/documents', documentsRouter)
app.route('/api/plugins/hypermultimedia', hypermultimediaRouter)
app.route('/api/email', emailRouter)
app.route('/api/push', pushRouter)
app.route('/api/admin', adminRouter)

// Initialize gateways (queue-only mode - workers run in hocuspocus-worker)
// This allows rest-api to scale to multiple replicas without duplicate workers
emailGateway.initialize(false).catch((err) => {
  restApiLogger.error({ err }, 'Failed to initialize email gateway')
})

pushGateway.initialize(false).catch((err) => {
  restApiLogger.error({ err }, 'Failed to initialize push gateway')
})

// Start server
const server = Bun.serve({
  fetch: app.fetch,
  port: parseInt(APP_PORT, 10),
  hostname: '0.0.0.0'
})

// Log server startup
restApiLogger.info({
  msg: '🚀 REST API Server started successfully',
  port: server.port,
  environment: NODE_ENV,
  url: `http://localhost:${server.port}`,
  config: {
    hocuspocus_logger: checkEnvBolean(HOCUSPOCUS_LOGGER),
    hocuspocus_throttle: checkEnvBolean(HOCUSPOCUS_THROTTLE),
    database: DATABASE_URL ? 'configured' : 'not set',
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
    process.exit(0)
  } catch (err) {
    restApiLogger.error({ err }, '❌ Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export default app
