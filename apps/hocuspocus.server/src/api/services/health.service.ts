import type { PrismaClient } from '@prisma/client'

import { getRedisStats } from '../../lib/redis'
import { getAnonClient } from '../../lib/supabase'
import type { HealthCheckResult, OverallHealthResult, RedisClient } from '../../types'

// Every caller of this route has a deadline: the admin dashboard aborts at 5 s
// and the container healthcheck at 5 s. Traefik no longer probes it, having moved
// to /health/live. An unbounded `ping()` inherits `REDIS_COMMAND_TIMEOUT`, whose
// default is 60 s, so a slow dependency failed the probe on the clock.
const HEALTH_CHECK_TIMEOUT_MS = 2000

// postgrest-js rejects with a plain object, not an Error, so an instanceof test
// alone dropped the real reason and reported "Unknown error" to the operator.
const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : ((error as { message?: string } | null)?.message ?? 'Unknown error')

const withDeadline = async <T>(work: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`)),
          HEALTH_CHECK_TIMEOUT_MS
        )
      })
    ])
  } finally {
    // Promise.race attaches its own handler to both inputs, so a late rejection
    // from the losing side is already handled. Only the timer needs clearing.
    clearTimeout(timer)
  }
}

export const checkDatabaseHealth = async (prisma: PrismaClient): Promise<HealthCheckResult> => {
  try {
    await withDeadline(prisma.$queryRaw`SELECT 1`, 'database')

    return {
      status: 'healthy',
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      lastCheck: new Date(),
      error: errorMessage(error)
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
    const pong = await withDeadline(redis.ping(), 'redis')
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
      error: errorMessage(error)
    }
  }
}

export const checkSupabaseHealth = async (): Promise<HealthCheckResult> => {
  try {
    // Inside the try on purpose. SUPABASE_URL is validated as a non-empty string
    // only, so a malformed value throws here, and checkAllServices below would
    // then answer 500 instead of 503.
    const supabase = getAnonClient()
    if (!supabase) {
      return { status: 'disabled', lastCheck: new Date() }
    }

    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      // An abort signal, not `withDeadline`: this deadline really cancels the
      // request, and the other two checks have nothing to cancel.
      .abortSignal(AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS))

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
      error: errorMessage(error)
    }
  }
}

export const checkAllServices = async (
  prisma: PrismaClient,
  redis: RedisClient | null
): Promise<OverallHealthResult> => {
  // Concurrent, so the route costs one deadline instead of three in a row. Each
  // check returns its own failure result, so this can never reject.
  const [database, redisHealth, supabase] = await Promise.all([
    checkDatabaseHealth(prisma),
    checkRedisHealth(redis),
    checkSupabaseHealth()
  ])

  const services = { database, redis: redisHealth, supabase }

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
