import type { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import type { RedisClient, HealthCheckResult, OverallHealthResult } from '../../types'
import { getPoolStats } from '../../lib/prisma'
import { checkRedisHealth as redisHealthCheck, getRedisStats } from '../../lib/redis'

export const checkDatabaseHealth = async (prisma: PrismaClient): Promise<HealthCheckResult> => {
  try {
    await prisma.$queryRaw`SELECT 1`

    // Get connection pool statistics
    const poolStats = getPoolStats()

    return {
      status: 'healthy',
      lastCheck: new Date(),
      metadata: {
        pool: {
          total: poolStats.total,
          idle: poolStats.idle,
          waiting: poolStats.waiting,
          active: poolStats.total - poolStats.idle
        }
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export const checkRedisHealth = async (redis: RedisClient | null): Promise<HealthCheckResult> => {
  if (!redis) {
    return {
      status: 'disabled',
      lastCheck: new Date()
    }
  }

  try {
    const healthy = await redisHealthCheck()
    const stats = getRedisStats()

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
      metadata: stats
        ? {
            status: stats.status,
            connected: stats.connected,
            commandQueueLength: stats.commandQueueLength,
            offlineQueueLength: stats.offlineQueue
          }
        : undefined
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export const checkSupabaseHealth = async (): Promise<HealthCheckResult> => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return {
      status: 'disabled',
      lastCheck: new Date()
    }
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

    // Simple query to check connection
    const { error } = await supabase.from('profiles').select('id').limit(1)

    if (error && !error.message.includes('permission')) {
      throw error
    }

    return {
      status: 'healthy',
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export const checkAllServices = async (
  prisma: PrismaClient,
  redis: RedisClient | null
): Promise<OverallHealthResult> => {
  const services = {
    database: await checkDatabaseHealth(prisma),
    redis: await checkRedisHealth(redis),
    supabase: await checkSupabaseHealth()
  }

  // Only fail if critical services (database/redis) are unhealthy
  // Supabase can be degraded without failing the whole health check
  const criticalServicesHealthy =
    services.database.status === 'healthy' &&
    (services.redis.status === 'healthy' || services.redis.status === 'disabled')

  const overallStatus = criticalServicesHealthy ? 'ok' : 'degraded'

  return {
    status: overallStatus,
    timestamp: new Date(),
    services
  }
}
