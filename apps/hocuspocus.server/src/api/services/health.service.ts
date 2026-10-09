import type { PrismaClient } from '@prisma/client'

import { restApiLogger } from '../../lib/logger'
import { getRedisStats } from '../../lib/redis'
import { getAnonClient } from '../../lib/supabase'
import type { HealthCheckResult, OverallHealthResult, RedisClient } from '../../types'

// Every caller of this route has a deadline: the admin dashboard aborts at 5 s
// and the container healthcheck at 5 s. Traefik no longer probes it, having moved
// to /health/live. An unbounded `ping()` inherits `REDIS_COMMAND_TIMEOUT`, whose
// default is 60 s, so a slow dependency failed the probe on the clock.
const HEALTH_CHECK_TIMEOUT_MS = 2000

// A /health flood must not cost a dependency call per request (#405). Each check
// catches its own error and never rejects, so a cached promise never holds a rejection.
const HEALTH_CACHE_MS = 5000
const cache = new Map<string, { at: number; result: Promise<HealthCheckResult> }>()

export const clearHealthCache = (): void => cache.clear()

// Keyed on the check alone: prod hands every request the same clients.
const memo = (check: string, run: () => Promise<HealthCheckResult>): Promise<HealthCheckResult> => {
  const hit = cache.get(check)
  if (hit && Date.now() - hit.at < HEALTH_CACHE_MS) return hit.result
  const result = run()
  cache.set(check, { at: Date.now(), result })
  return result
}

// The body carries no driver text, because it can name a host and a port. The
// reason goes to the log instead.
const unhealthy = (check: string, error: unknown): HealthCheckResult => {
  restApiLogger.warn({ err: error, check }, 'Health check failed')
  return { status: 'unhealthy', lastCheck: new Date() }
}

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

const runDatabaseCheck = async (prisma: PrismaClient): Promise<HealthCheckResult> => {
  try {
    await withDeadline(prisma.$queryRaw`SELECT 1`, 'database')

    return {
      status: 'healthy',
      lastCheck: new Date()
    }
  } catch (error) {
    return unhealthy('database', error)
  }
}

const runRedisCheck = async (redis: RedisClient | null): Promise<HealthCheckResult> => {
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
    return unhealthy('redis', error)
  }
}

const runSupabaseCheck = async (): Promise<HealthCheckResult> => {
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
    return unhealthy('supabase', error)
  }
}

export const checkDatabaseHealth = (prisma: PrismaClient): Promise<HealthCheckResult> =>
  memo('database', () => runDatabaseCheck(prisma))

export const checkRedisHealth = (redis: RedisClient | null): Promise<HealthCheckResult> =>
  memo('redis', () => runRedisCheck(redis))

export const checkSupabaseHealth = (): Promise<HealthCheckResult> =>
  memo('supabase', runSupabaseCheck)

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
