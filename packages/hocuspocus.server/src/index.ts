import { Hono } from 'hono'
import chalk from 'chalk'
import { prisma } from './lib/prisma'
import { getRedisClient } from './lib/redis'
import { setupMiddleware } from './middleware'
import { createDocumentWorker } from './lib/queue'
import healthRouter from './api/health'
import documentsRouter from './api/documents'
import hypermultimediaRouter from './api/hypermultimedia'
import { checkEnvBolean } from './utils'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const {
  APP_PORT = '3001',
  NODE_ENV,
  HOCUSPOCUS_LOGGER,
  HOCUSPOCUS_THROTTLE,
  DATABASE_URL
} = process.env

// Create Hono app
const app = new Hono()

// Initialize Redis
const redis = getRedisClient()

// Setup middleware
setupMiddleware(app)

// Inject dependencies into context
app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  c.set('redis', redis)
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

// Start BullMQ worker for document storage
if (redis) {
  createDocumentWorker()
  console.log('✅ BullMQ document worker started')
}

// Start server
const server = Bun.serve({
  fetch: app.fetch,
  port: parseInt(APP_PORT, 10),
  hostname: '0.0.0.0'
})

console.info(`
  ${chalk.green.bold('🚀 Server started successfully!')}

  ${chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
  ${chalk.bold('Server Info:')}
  Port: ${chalk.blue.bold(server.port)}
  Environment: ${chalk.blue.bold(NODE_ENV)}
  URL: ${chalk.bold.underline.yellow(`http://localhost:${server.port}`)} ${chalk.gray('(ctrl+click)')}

  ${chalk.bold('Configuration:')}
  HOCUSPOCUS_LOGGER: ${chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_LOGGER))}
  HOCUSPOCUS_THROTTLE: ${chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_THROTTLE))}
  DATABASE_URL: ${chalk.blue.bold(DATABASE_URL ? '✓ Configured' : '✗ Not set')}
  REDIS: ${chalk.blue.bold(redis ? '✓ Connected' : '✗ Disabled')}
  ${chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
`)

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await prisma.$disconnect()
  if (redis) await redis.quit()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await prisma.$disconnect()
  if (redis) await redis.quit()
  process.exit(0)
})

export default app
