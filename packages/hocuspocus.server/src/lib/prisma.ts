import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { dbLogger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

/**
 * Production-ready Prisma Client with proper connection pooling
 *
 * Features:
 * - PostgreSQL connection pooling via pg Pool
 * - Configurable pool size and timeouts
 * - Automatic connection management
 * - Health monitoring
 * - Graceful shutdown
 */

// Get DATABASE_URL - preserve full URL including query params (?sslmode=require, etc.)
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  return url
}

// Connection pool configuration
const poolConfig = {
  connectionString: getDatabaseUrl(),
  max: parseInt(process.env.DB_POOL_SIZE || process.env.DB_CONNECTION_LIMIT || '20', 10),
  // Increased idle timeout to prevent connections from closing too quickly
  // Health checks and low-traffic scenarios shouldn't cause connection churn
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || (process.env.NODE_ENV === 'development' ? '300000' : '60000'), 10), // 5min dev, 1min prod
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
  // Enable keep-alive to prevent connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Statement timeout to prevent long-running queries
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
  // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  // SSL config:
  // - Production: Enable SSL for managed DBs (DigitalOcean, etc.) - rejectUnauthorized: false for self-signed certs
  // - Development: undefined = no SSL override, uses connectionString defaults (local Docker Postgres typically has no SSL)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
}

// Create PostgreSQL connection pool
const pool =
  globalForPrisma.pool ??
  new Pool(poolConfig)

// Pool event handlers for monitoring
pool.on('connect', () => {
  // Only log in development - connection creation is normal
  if (process.env.NODE_ENV === 'development') {
    dbLogger.debug({ poolSize: pool.totalCount }, 'New database connection established')
  }
})

pool.on('acquire', () => {
  const stats = getPoolStats()

  // Development: log all acquisitions
  if (process.env.NODE_ENV === 'development') {
    dbLogger.debug({ poolSize: stats.total, idle: stats.idle }, 'Connection acquired from pool')
  }

  // Production: warn if pool is getting exhausted (80%+ utilization)
  if (process.env.NODE_ENV === 'production' && stats.total >= poolConfig.max * 0.8) {
    dbLogger.warn({
      total: stats.total,
      idle: stats.idle,
      waiting: stats.waiting,
      max: poolConfig.max,
      utilization: `${Math.round((stats.total / poolConfig.max) * 100)}%`
    }, 'Database pool utilization high - consider increasing DB_POOL_SIZE')
  }
})

pool.on('error', (err: any) => {
  // Handle specific PostgreSQL error codes
  const errorCode = err.code

  // 57P01: terminating connection due to administrator command
  // This is normal during database restarts/maintenance - don't log as error
  if (errorCode === '57P01') {
    dbLogger.debug({
      code: errorCode,
      message: 'Database connection terminated (likely during maintenance/restart)'
    }, 'Connection terminated by database - will be automatically replaced')
    return
  }

  // 57P02: terminating connection due to administrator command (alternative)
  if (errorCode === '57P02') {
    dbLogger.debug({
      code: errorCode,
      message: 'Database connection terminated'
    }, 'Connection terminated - will be automatically replaced')
    return
  }

  // 57P03: cannot connect now (database startup/shutdown)
  if (errorCode === '57P03') {
    dbLogger.warn({
      code: errorCode,
      message: 'Database temporarily unavailable - connection will retry'
    }, 'Database connection unavailable')
    return
  }

  // Connection errors that are recoverable
  const recoverableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
  if (recoverableErrors.some(code => err.code === code || err.message?.includes(code))) {
    dbLogger.warn({
      code: err.code,
      message: err.message
    }, 'Database connection error - will retry automatically')
    return
  }

  // Log other errors as actual errors
  dbLogger.error({
    err,
    code: errorCode,
    message: err.message
  }, 'Unexpected database pool error')
})

pool.on('remove', () => {
  // Only log in development - connection removal is normal (idle timeout, errors, etc.)
  if (process.env.NODE_ENV === 'development') {
    dbLogger.debug({ poolSize: pool.totalCount, idle: pool.idleCount }, 'Connection removed from pool')
  }
})

// Create Prisma adapter
const adapter = new PrismaPg(pool)

// Create Prisma Client with adapter
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' }
        ]
      : [
          { level: 'error', emit: 'event' }
        ]
  })

// Log Prisma events
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    dbLogger.debug({ duration: `${e.duration}ms`, query: e.query }, 'Database query')
  })
}

prisma.$on('error' as never, (e: any) => {
  dbLogger.error({ err: e }, 'Database error')
})

prisma.$on('warn' as never, (e: any) => {
  dbLogger.warn(e, 'Database warning')
})

// Store in global for development hot-reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.pool = pool
}

// Log pool configuration on startup
dbLogger.info({
  maxConnections: poolConfig.max,
  idleTimeout: poolConfig.idleTimeoutMillis,
  connectionTimeout: poolConfig.connectionTimeoutMillis
}, 'Database connection pool initialized')

/**
 * Get current pool statistics
 * Useful for monitoring and debugging connection pool issues
 */
export const getPoolStats = () => ({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount,
  active: pool.totalCount - pool.idleCount,
  max: poolConfig.max,
  utilization: pool.totalCount > 0 ? Math.round((pool.totalCount / poolConfig.max) * 100) : 0
})

/**
 * Health check for database connection
 * Includes pool statistics for monitoring
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`

    // Log pool stats in production if pool is getting exhausted
    const stats = getPoolStats()
    if (process.env.NODE_ENV === 'production' && stats.waiting > 0) {
      dbLogger.warn({
        waiting: stats.waiting,
        total: stats.total,
        idle: stats.idle,
        max: poolConfig.max
      }, 'Database pool has waiting connections - potential bottleneck')
    }

    return true
  } catch (error) {
    dbLogger.error({ err: error }, 'Database health check failed')
    return false
  }
}

/**
 * Graceful shutdown helper (call from entry points only)
 */
export const shutdownDatabase = async () => {
  dbLogger.info('Shutting down database connections...')

  try {
    await prisma.$disconnect()
    dbLogger.info('Prisma disconnected')

    await pool.end()
    dbLogger.info('Connection pool closed')

    dbLogger.info('✅ Database shutdown complete')
  } catch (error) {
    dbLogger.error({ err: error }, 'Error during database shutdown')
  }
}

export { pool }
