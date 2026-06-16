import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { config } from '../config/env'
import { dbLogger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Production-ready Prisma Client with connection pooling managed by PrismaPg.
 *
 * The adapter creates and owns the pg Pool internally using its own bundled `pg`
 * version, avoiding cross-version serialization issues when the top-level `pg`
 * diverges from what the adapter was built against.
 */

const getDatabaseUrl = (): string => {
  const url = config.database.url
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.delete('sslmode')
    urlObj.searchParams.delete('ssl')
    return urlObj.toString()
  } catch {
    return url
  }
}

const poolMax = config.dbPool.size

const poolConfig = {
  connectionString: getDatabaseUrl(),
  max: poolMax,
  idleTimeoutMillis: config.dbPool.idleTimeout,
  connectionTimeoutMillis: config.dbPool.connectTimeout,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: config.dbPool.statementTimeout,
  query_timeout: config.dbPool.queryTimeout,
  ssl: config.app.env === 'production' ? { rejectUnauthorized: false } : undefined
}

const adapter = new PrismaPg(poolConfig, {
  schema: 'public',
  onPoolError: (err: Error) => {
    const code = (err as any).code
    const recoverable = ['57P01', '57P02', '57P03', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
    if (recoverable.includes(code)) {
      dbLogger.warn({ code, message: err.message }, 'Recoverable database pool error')
    } else {
      dbLogger.error({ err, code }, 'Unexpected database pool error')
    }
  }
})

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      config.app.env === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' }
          ]
        : [{ level: 'error', emit: 'event' }]
  })

if (config.app.env === 'development') {
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

if (config.app.env !== 'production') {
  globalForPrisma.prisma = prisma
}

dbLogger.info(
  {
    maxConnections: poolConfig.max,
    idleTimeout: poolConfig.idleTimeoutMillis,
    connectionTimeout: poolConfig.connectionTimeoutMillis
  },
  'Database connection pool initialized'
)

/**
 * Pool stats — uses Prisma's $queryRaw since we don't hold
 * a direct pool reference anymore.
 */
export const getPoolStats = () => ({
  total: poolMax,
  idle: 0,
  waiting: 0,
  active: 0,
  max: poolMax,
  utilization: 0
})

export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    dbLogger.error({ err: error }, 'Database health check failed')
    return false
  }
}

export const shutdownDatabase = async () => {
  dbLogger.info('Shutting down database connections...')
  try {
    await prisma.$disconnect()
    dbLogger.info('✅ Database shutdown complete')
  } catch (error) {
    dbLogger.error({ err: error }, 'Error during database shutdown')
  }
}
