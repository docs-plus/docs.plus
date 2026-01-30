import type { PrismaClient } from '@prisma/client'

import type { RedisClient } from './redis.types'

// Hono app context with injected dependencies
export interface AppContext {
  prisma: PrismaClient
  redis: RedisClient | null
}
