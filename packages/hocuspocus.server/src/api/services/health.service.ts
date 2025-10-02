import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import { createClient } from '@supabase/supabase-js'

type HealthStatus = 'healthy' | 'unhealthy' | 'disabled'

interface HealthCheckResult {
  status: HealthStatus
  lastCheck: Date
  error?: string
}

interface OverallHealthResult {
  status: 'ok' | 'degraded'
  timestamp: Date
  services: {
    database: HealthCheckResult
    redis: HealthCheckResult
    supabase: HealthCheckResult
  }
}

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

export const checkRedisHealth = async (redis: Redis | null): Promise<HealthCheckResult> => {
  if (!redis) {
    return {
      status: 'disabled',
      lastCheck: new Date()
    }
  }

  try {
    await redis.ping()
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
  redis: Redis | null
): Promise<OverallHealthResult> => {
  const services = {
    database: await checkDatabaseHealth(prisma),
    redis: await checkRedisHealth(redis),
    supabase: await checkSupabaseHealth()
  }

  const overallStatus = Object.values(services).some((s) => s.status === 'unhealthy')
    ? 'degraded'
    : 'ok'

  return {
    status: overallStatus,
    timestamp: new Date(),
    services
  }
}
