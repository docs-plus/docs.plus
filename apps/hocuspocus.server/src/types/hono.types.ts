/**
 * Hono Type Extensions
 *
 * Extends Hono's context with our custom variables and defines
 * typed context helpers for controllers.
 */

import type { PrismaClient } from '@prisma/client'
import type { Context } from 'hono'

import type { SupabaseUser } from '../lib/auth'
import type { RedisClient } from './redis.types'

// =============================================================================
// Context Variable Map Extension
// =============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    prisma: PrismaClient
    redis: RedisClient | null
    /** Verified Supabase subject. Set by requireUser/adminAuth; absent on optionalUser routes. */
    userId?: string
    /** Verified Supabase user. Set by requireUser/adminAuth; absent on optionalUser routes. */
    user?: SupabaseUser
  }
}

// =============================================================================
// Typed Context Aliases
// =============================================================================

/**
 * Base application context with prisma and redis
 */
export type AppContext = Context<{
  Variables: {
    prisma: PrismaClient
    redis: RedisClient | null
    userId?: string
    user?: SupabaseUser
  }
}>
