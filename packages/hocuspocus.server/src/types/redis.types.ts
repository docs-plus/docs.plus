import type Redis from 'ioredis'

export type RedisClient = Redis

// Redis save confirmation message
export interface SaveConfirmation {
  documentId: string
  version: number
  timestamp: number
}
