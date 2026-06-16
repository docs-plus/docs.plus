import type { PrismaClient } from '@prisma/client'

import { getRedisStats } from '../../lib/redis'
import { getAnonClient } from '../../lib/supabase'
import type { HealthCheckResult, OverallHealthResult, RedisClient } from '../../types'

export const checkDatabaseHealth = async (prisma: PrismaClient): Promise<HealthCheckResult> => {
  try {
    await prisma.$queryRaw`SELECT 1`

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

export const checkRedisHealth = async (redis: RedisClient | null): Promise<HealthCheckResult> => {
  if (!redis) {
    return {
      status: 'disabled',
      lastCheck: new Date()
    }
  }

  try {
    // Probe the injected client (the request-scoped singleton in prod) so the
    // result reflects the connection actually handed to this request.
    const pong = await redis.ping()
    const stats = getRedisStats()

    return {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
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
  const supabase = getAnonClient()
  if (!supabase) {
    return {
      status: 'disabled',
      lastCheck: new Date()
    }
  }

  try {
    const { error } = await supabase.from('users').select('id').limit(1)

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
