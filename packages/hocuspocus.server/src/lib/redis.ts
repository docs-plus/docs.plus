import { RedisClient } from 'bun'
import type { RedisClient as RedisClientType } from '../types'

let redis: RedisClientType | null = null

/**
 * Get Bun's native Redis client (v1.2.9+)
 * - Blazing fast with zero overhead
 * - Auto-reconnection with exponential backoff
 * - Native RESP3 protocol support
 * - Automatic pipelining
 */
export const getRedisClient = (): RedisClientType | null => {
  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    console.warn('Redis configuration not found. Redis features will be disabled.')
    return null
  }

  if (!redis) {
    // Build Redis URL
    const password = process.env.REDIS_PASSWORD
    const host = process.env.REDIS_HOST
    const port = process.env.REDIS_PORT
    const db = process.env.REDIS_DB || '0'

    const url = password
      ? `redis://:${password}@${host}:${port}/${db}`
      : `redis://${host}:${port}/${db}`

    // Create Bun's native Redis client
    redis = new RedisClient(url, {
      connectionTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      idleTimeout: parseInt(process.env.REDIS_IDLE_TIMEOUT || '30000', 10),
      autoReconnect: true,
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '10', 10),
      enableOfflineQueue: true,
      enableAutoPipelining: true
    })

    // Connection event handlers
    redis.onconnect = () => {
      console.log('✅ Redis connected successfully')
    }

    redis.onclose = (error?: Error) => {
      if (error) {
        console.error('⚠️  Redis connection closed with error:', error)
      } else {
        console.warn('⚠️  Redis connection closed')
      }
    }

    // Connect
    redis.connect().catch((err: Error) => {
      console.error('Failed to connect to Redis:', err)
    })
  }

  return redis
}

export const disconnectRedis = async () => {
  if (redis) {
    redis.close()
    redis = null
  }
}
