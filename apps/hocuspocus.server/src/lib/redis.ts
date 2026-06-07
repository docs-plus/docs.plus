import Redis, { type RedisOptions } from 'ioredis'

import type { RedisClient } from '../types'
import { redisLogger } from './logger'

const globalForRedis = globalThis as unknown as {
  redis: RedisClient | null
  redisSubscriber: RedisClient | null
  redisPublisher: RedisClient | null
}

/**
 * Production-ready Redis client using ioredis
 *
 * Features:
 * - Connection pooling and keep-alive
 * - Auto-reconnect with exponential backoff
 * - Lazy connect (connects on first command)
 * - Proper error handling and logging
 * - Graceful shutdown
 * - Dedicated clients for pub/sub
 */

/**
 * Build shared Redis configuration options
 * @param host - Redis host
 * @param port - Redis port
 * @param label - Label for logging (e.g., 'sync', 'queue')
 */
const buildRedisConfig = (host: string, port: number, label = 'main') => {
  return {
    host,
    port,

    // Connection settings
    lazyConnect: false, // Connect immediately on creation
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '20000', 10),
    keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10),

    // Retry strategy with exponential backoff
    // In production: retry forever with capped delay (Redis may restart)
    // In development: stop after maxRetries to fail fast
    retryStrategy: (times: number) => {
      const isProduction = process.env.NODE_ENV === 'production'
      const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10)

      // Development: fail fast after max retries
      if (!isProduction && times > maxRetries) {
        redisLogger.error({ times, redis: label }, 'Redis max retries exceeded (dev mode)')
        return null
      }

      // Production: never give up, but log warnings
      if (times > maxRetries) {
        redisLogger.warn(
          { times, redis: label },
          'Redis reconnecting (exceeded initial retries, will keep trying)'
        )
      }

      // Exponential backoff: 200ms, 400ms, 800ms... capped at 10s in prod, 5s in dev
      const maxDelay = isProduction ? 10000 : 5000
      const delay = Math.min(times * 200, maxDelay)
      redisLogger.warn({ times, delay: `${delay}ms`, redis: label }, 'Redis reconnecting...')
      return delay
    },

    // Auto-pipelining for better performance
    enableAutoPipelining: true,
    autoPipeliningIgnoredCommands: ['ping'],

    // Command timeout (increased for dev to avoid false timeouts during hot reload)
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '30000', 10),

    // Offline queue (queue commands when disconnected)
    // Enable in both dev and prod to prevent command timeout errors during reconnection
    enableOfflineQueue: true,

    // TLS for production (if needed)
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,

    // Reconnect on error - include all connection-related errors
    reconnectOnError: (err: Error) => {
      const targetErrors = [
        'READONLY',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'ENOTFOUND',
        'Connection is closed'
      ]
      if (targetErrors.some((targetError) => err.message.includes(targetError))) {
        redisLogger.warn({ err: err.message, redis: label }, 'Reconnecting on error')
        return true
      }
      return false
    }
  }
}

/**
 * Get config for SYNC Redis (Hocuspocus Y.js sync, pub/sub, awareness)
 * Uses REDIS_HOST / REDIS_PORT (primary Redis)
 */
const getRedisConfig = () => {
  const host = process.env.REDIS_HOST
  const port = process.env.REDIS_PORT

  if (!host || !port) {
    return null
  }

  return buildRedisConfig(host, parseInt(port, 10), 'sync')
}

/**
 * Get config for QUEUE Redis (BullMQ job queues)
 * Uses REDIS_QUEUE_HOST / REDIS_QUEUE_PORT if set, otherwise falls back to main Redis
 * This allows running with single Redis in dev, dual Redis in prod
 */
const getQueueRedisConfig = () => {
  // Try queue-specific config first
  const queueHost = process.env.REDIS_QUEUE_HOST
  const queuePort = process.env.REDIS_QUEUE_PORT

  if (queueHost && queuePort) {
    return buildRedisConfig(queueHost, parseInt(queuePort, 10), 'queue')
  }

  // Fall back to main Redis (single Redis mode)
  const mainHost = process.env.REDIS_HOST
  const mainPort = process.env.REDIS_PORT

  if (mainHost && mainPort) {
    redisLogger.info('REDIS_QUEUE_HOST not set, using main Redis for queues')
    return buildRedisConfig(mainHost, parseInt(mainPort, 10), 'queue')
  }

  return null
}

// Main Redis client (for general operations)
let redis: RedisClient | null = globalForRedis.redis ?? null

export const getRedisClient = (): RedisClient | null => {
  const config = getRedisConfig()

  if (!config) {
    if (!redis) {
      redisLogger.warn('Redis configuration not found. Redis features will be disabled.')
    }
    return null
  }

  if (!redis) {
    redisLogger.info(
      {
        host: config.host,
        port: config.port,
        lazyConnect: config.lazyConnect,
        connectTimeout: config.connectTimeout
      },
      'Creating new Redis client...'
    )

    redis = new Redis(config)

    // Event handlers
    redis.on('connect', () => {
      redisLogger.info({ host: config.host, port: config.port }, 'Redis connecting...')
    })

    redis.on('ready', () => {
      redisLogger.info({ host: config.host, port: config.port }, 'Redis ready')
    })

    redis.on('error', (err: Error) => {
      redisLogger.error({ err }, 'Redis error')
    })

    redis.on('close', () => {
      redisLogger.warn('Redis connection closed')
    })

    redis.on('reconnecting', (delay: number) => {
      redisLogger.info({ delay: `${delay}ms` }, 'Redis reconnecting...')
    })

    redis.on('end', () => {
      redisLogger.info('Redis connection ended')
    })

    // Store in global for development hot-reload
    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redis = redis
    }
  }

  return redis
}

// Wait for Redis client to be ready (with auto-connect, it should be connecting already)
export const waitForRedisReady = async (
  client: RedisClient,
  timeoutMs = 10000
): Promise<boolean> => {
  if (client.status === 'ready') {
    return true
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      redisLogger.error({ status: client.status }, 'Redis ready timeout - connection failed')
      resolve(false)
    }, timeoutMs)

    client.once('ready', () => {
      clearTimeout(timeout)
      resolve(true)
    })

    // Handle connection errors during wait
    const errorHandler = (err: Error) => {
      redisLogger.error({ err }, 'Redis connection error during startup')
      clearTimeout(timeout)
      resolve(false)
    }

    client.once('error', errorHandler)
  })
}

// Dedicated subscriber client (required for pub/sub pattern)
let redisSubscriber: RedisClient | null = globalForRedis.redisSubscriber ?? null

export const getRedisSubscriber = (): RedisClient | null => {
  const config = getRedisConfig()

  if (!config) {
    return null
  }

  if (!redisSubscriber) {
    redisSubscriber = new Redis(config)

    redisSubscriber.on('ready', () => {
      redisLogger.info('Redis subscriber ready')
    })

    redisSubscriber.on('error', (err: Error) => {
      redisLogger.error({ err }, 'Redis subscriber error')
    })

    // Store in global for development hot-reload
    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redisSubscriber = redisSubscriber
    }
  }

  return redisSubscriber
}

// Dedicated publisher client (recommended for pub/sub pattern)
let redisPublisher: RedisClient | null = globalForRedis.redisPublisher ?? null

export const getRedisPublisher = (): RedisClient | null => {
  const config = getRedisConfig()

  if (!config) {
    return null
  }

  if (!redisPublisher) {
    redisPublisher = new Redis(config)

    redisPublisher.on('ready', () => {
      redisLogger.info('Redis publisher ready')
    })

    redisPublisher.on('error', (err: Error) => {
      redisLogger.error({ err }, 'Redis publisher error')
    })

    // Store in global for development hot-reload
    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redisPublisher = redisPublisher
    }
  }

  return redisPublisher
}

/**
 * Create a new dedicated Redis connection for SYNC operations (Hocuspocus)
 * Uses REDIS_HOST / REDIS_PORT
 */
export const createRedisConnection = (options: Partial<RedisOptions> = {}): RedisClient | null => {
  const config = getRedisConfig()

  if (!config) {
    redisLogger.warn('Cannot create Redis sync connection: config not found')
    return null
  }

  const commandTimeout =
    options.commandTimeout ?? parseInt(process.env.REDIS_COMMAND_TIMEOUT || '60000', 10)

  return new Redis({
    ...config,
    ...options,
    commandTimeout
  })
}

/**
 * Create a new dedicated Redis connection for QUEUE operations (BullMQ)
 * Uses REDIS_QUEUE_HOST / REDIS_QUEUE_PORT, falls back to main Redis
 */
export const createQueueRedisConnection = (
  options: Partial<RedisOptions> = {}
): RedisClient | null => {
  const config = getQueueRedisConfig()

  if (!config) {
    redisLogger.warn('Cannot create Redis queue connection: config not found')
    return null
  }

  // BullMQ needs higher timeout for long-running operations
  const commandTimeout =
    options.commandTimeout ?? parseInt(process.env.REDIS_COMMAND_TIMEOUT || '60000', 10)

  return new Redis({
    ...config,
    ...options,
    commandTimeout
  })
}

// Get Redis connection stats (for monitoring)
export const getRedisStats = () => {
  if (!redis) {
    return null
  }

  return {
    status: redis.status,
    connected: redis.status === 'ready',
    // @ts-ignore - accessing internal property for monitoring
    commandQueueLength: redis.commandQueue?.length || 0,
    // @ts-ignore
    offlineQueue: redis.offlineQueue?.length || 0
  }
}

// Health check
export const checkRedisHealth = async (): Promise<boolean> => {
  const client = getRedisClient()

  if (!client) {
    return false
  }

  try {
    const result = await client.ping()
    return result === 'PONG'
  } catch (error) {
    redisLogger.error({ err: error }, 'Redis health check failed')
    return false
  }
}

/**
 * Graceful shutdown helper (call from entry points only)
 */
export const disconnectRedis = async () => {
  redisLogger.info('Shutting down Redis connections...')

  const clients = [
    { name: 'main', client: redis },
    { name: 'subscriber', client: redisSubscriber },
    { name: 'publisher', client: redisPublisher }
  ]

  for (const { name, client } of clients) {
    if (client) {
      try {
        await client.quit()
        redisLogger.info({ client: name }, 'Redis client disconnected')
      } catch (error) {
        redisLogger.error({ err: error, client: name }, 'Error disconnecting Redis client')
        // Force disconnect on error
        client.disconnect()
      }
    }
  }

  redis = null
  redisSubscriber = null
  redisPublisher = null

  redisLogger.info('✅ Redis shutdown complete')
}

export { Redis }
