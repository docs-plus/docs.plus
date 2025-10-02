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
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: true
    })

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully')
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
