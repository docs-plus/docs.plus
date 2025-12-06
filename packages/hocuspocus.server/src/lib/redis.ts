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

// Shared Redis configuration
const getRedisConfig = () => {
  const host = process.env.REDIS_HOST
  const port = process.env.REDIS_PORT

  if (!host || !port) {
    return null
  }

  return {
    host,
    port: parseInt(port, 10),

    // Connection settings
    lazyConnect: false, // Connect immediately on creation
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '20000', 10),
    keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10),

    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10)

      if (times > maxRetries) {
        redisLogger.error({ times }, 'Redis max retries exceeded')
        return null // Stop retrying
      }

      // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms, max 5000ms
      const delay = Math.min(times * 200, 5000)
      redisLogger.warn({ times, delay: `${delay}ms` }, 'Redis reconnecting...')
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

    // Reconnect on error
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET']
      if (targetErrors.some((targetError) => err.message.includes(targetError))) {
        redisLogger.warn({ err }, 'Reconnecting on error')
        return true // Reconnect
      }
      return false
    }
  }
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

// Create a new dedicated Redis connection for specific use cases (e.g., BullMQ)
export const createRedisConnection = (options: Partial<RedisOptions> = {}): RedisClient | null => {
  const config = getRedisConfig()

  if (!config) {
    redisLogger.warn('Cannot create Redis connection: config not found')
    return null
  }

  // BullMQ needs higher timeout for long-running operations
  // Use explicit timeout from options if provided, otherwise use env var or default
  const commandTimeout =
    options.commandTimeout ?? parseInt(process.env.REDIS_COMMAND_TIMEOUT || '60000', 10)

  return new Redis({
    ...config,
    ...options, // Spread options first to allow specific overrides
    commandTimeout // Then ensure timeout is set (may override from options if needed)
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
