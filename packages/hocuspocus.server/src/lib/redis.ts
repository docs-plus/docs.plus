import Redis from 'ioredis'
import type { RedisClient } from '../types'

let redis: RedisClient | null = null

export const getRedisClient = (): RedisClient | null => {
  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    console.warn('Redis configuration not found. Redis features will be disabled.')
    return null
  }

  if (!redis) {
    // Using ioredis (required by BullMQ anyway)
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
      keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10),
      lazyConnect: true,
      retryStrategy(times) {
        const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10)
        if (times > maxRetries) {
          console.error(`Redis: Max retry attempts (${maxRetries}) reached.`)
          return null
        }
        const delay = Math.min(times * 100, 3000)
        console.warn(`Redis: Retry attempt ${times}/${maxRetries} in ${delay}ms`)
        return delay
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        return targetErrors.some((targetError) => err.message.includes(targetError))
      }
    })

    redis.on('error', (err) => console.error('Redis Client Error:', err))
    redis.on('connect', () => console.log('✅ Redis connected successfully'))
    redis.on('ready', () => console.log('✅ Redis ready'))
    redis.on('reconnecting', (delay: number) => console.warn(`🔄 Redis reconnecting in ${delay}ms`))
    redis.on('close', () => console.warn('⚠️  Redis connection closed'))

    redis.connect().catch((err) => console.error('Failed to connect to Redis:', err))
  }

  return redis
}

export const disconnectRedis = async () => {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
