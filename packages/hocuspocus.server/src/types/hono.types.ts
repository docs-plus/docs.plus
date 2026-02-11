/**
 * Hono Type Extensions
 *
 * Extends Hono's context with our custom variables and defines
 * typed context helpers for controllers.
 */

import type { PrismaClient } from '@prisma/client'
import type { Context } from 'hono'

import type { SupabaseUser } from '../utils/jwt'
import type { RedisClient } from './redis.types'

// =============================================================================
// Context Variable Map Extension
// =============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    prisma: PrismaClient
    redis: RedisClient | null
    /** Set by adminAuthMiddleware — JWT subject (user UUID) */
    userId: string
    /** Set by adminAuthMiddleware — decoded JWT payload */
    user: SupabaseUser
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
    userId: string
    user: SupabaseUser
  }
}>

/**
 * Context for routes that don't need database access
 */
export type BasicContext = Context

// =============================================================================
// Response Type Helpers
// =============================================================================

export type ControllerHandler = (c: AppContext) => Promise<Response>
export type BasicHandler = (c: BasicContext) => Promise<Response> | Response
