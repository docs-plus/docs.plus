import type { ConnectionOptions } from 'bullmq'
import type Redis from 'ioredis'

export type RedisClient = Redis

export type BullMQConnection = ConnectionOptions

/**
 * ioredis and BullMQ's bundled copy mismatch at the type level only; the cast is
 * safe because BullMQ accepts ioredis instances at runtime.
 * @see https://github.com/taskforcesh/bullmq/issues/1543
 */
export function toBullMQConnection(redis: Redis | null): BullMQConnection | null {
  if (!redis) return null
  return redis as any
}

export interface SaveConfirmation {
  documentId: string
  version: number
  timestamp: number
}
