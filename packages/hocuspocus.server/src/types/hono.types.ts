import type { PrismaClient } from '@prisma/client'
import type { RedisClient } from './redis.types'

// Extend Hono's context with our custom variables
declare module 'hono' {
  interface ContextVariableMap {
    prisma: PrismaClient
    redis: RedisClient | null
  }
}
