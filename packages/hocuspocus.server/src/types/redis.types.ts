import type Redis from 'ioredis'

// Redis client type (using ioredis, required by BullMQ)
export type RedisClient = Redis

// Redis save confirmation message
export interface SaveConfirmation {
  documentId: string
  version: number
  timestamp: number
}
