import type { ConnectionOptions } from 'bullmq'
import type Redis from 'ioredis'

export type RedisClient = Redis

/**
 * BullMQ-compatible connection type.
 * BullMQ and ioredis have slight type mismatches in their connection options
 * due to version differences in node_modules. This type bridges the gap.
 */
export type BullMQConnection = ConnectionOptions

/**
 * Helper to cast ioredis client to BullMQ connection.
 *
 * BullMQ internally uses ioredis and accepts Redis instances directly.
 * However, due to version mismatches between ioredis in node_modules,
 * TypeScript complains about type incompatibility. This cast is safe
 * because the runtime behavior is identical.
 *
 * @see https://github.com/taskforcesh/bullmq/issues/1543
 */
export function toBullMQConnection(redis: Redis | null): BullMQConnection | null {
  if (!redis) return null
  // Safe cast - BullMQ accepts ioredis instances at runtime

  return redis as any
}

// Redis save confirmation message
export interface SaveConfirmation {
  documentId: string
  version: number
  timestamp: number
}
