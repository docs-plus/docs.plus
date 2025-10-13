import Redis from 'ioredis'

let redis: Redis | null = null

export const getRedisClient = (): Redis | null => {
  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    console.warn('Redis configuration not found. Redis features will be disabled.')
    return null
  }

  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      // Connection pool and performance settings
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      // Timeouts for production reliability
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
      // Keep connections alive to reduce reconnection overhead
      keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10),
      // Connection pool settings (ioredis handles internally)
      lazyConnect: true,
      // Retry strategy with exponential backoff and max attempts
      retryStrategy(times) {
        const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10)
        if (times > maxRetries) {
          console.error(`Redis: Max retry attempts (${maxRetries}) reached. Stopping retries.`)
          return null // Stop retrying
        }
        const delay = Math.min(times * 100, 3000) // Max 3s delay
        console.warn(`Redis: Retry attempt ${times}/${maxRetries} in ${delay}ms`)
        return delay
      },
      // Reconnect on error
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        return targetErrors.some((targetError) => err.message.includes(targetError))
      }
    })

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully')
    })

    redis.on('ready', () => {
      console.log('✅ Redis ready to accept commands')
    })

    redis.on('reconnecting', (delay: number) => {
      console.warn(`🔄 Redis reconnecting in ${delay}ms...`)
    })

    redis.on('close', () => {
      console.warn('⚠️  Redis connection closed')
    })

    // Connect async
    redis.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err)
    })
  }

  return redis
}

export const disconnectRedis = async () => {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectRedis()
})

process.on('SIGTERM', async () => {
  await disconnectRedis()
})
