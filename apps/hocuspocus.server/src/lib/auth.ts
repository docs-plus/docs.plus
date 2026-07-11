import { timingSafeEqual } from 'node:crypto'

import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { config } from '../config/env'
import { jwtLogger } from './logger'
import { getAnonClient } from './supabase'

/**
 * Supabase user data from token verification
 */
export interface SupabaseUser {
  sub: string
  email?: string
  is_anonymous?: boolean
  user_metadata?: {
    full_name?: string
    name?: string
    avatar_url?: string
  }
}

export type TokenVerifyOutcome =
  | { kind: 'user'; user: SupabaseUser }
  | { kind: 'invalid' }
  | { kind: 'unavailable'; cause?: unknown }

type AuthGetUser = (token: string) => Promise<{
  data: {
    user: {
      id: string
      email?: string
      is_anonymous?: boolean
      user_metadata?: unknown
    } | null
  }
  error: { status?: number; message?: string } | null
}>

export type VerifyTokenOptions = {
  /** Test seam — production always uses the anon Supabase client. */
  getUser?: AuthGetUser
}

/** auth-js RETURNS (not throws) AuthError for 429/5xx/network — treat those as unavailable. */
export function isTransientAuthFailure(error: { status?: number } | null | undefined): boolean {
  if (error == null) return false
  const status = error.status
  return isAuthRetryableFetchError(error) || status == null || status === 429 || status >= 500
}

// Short-TTL cache: verifying a Supabase JWT is a network round-trip, and WS
// reconnect storms re-verify the same token repeatedly. 60s of staleness on a
// revoked token is an accepted trade for not hammering Supabase Auth.
const TOKEN_CACHE_TTL_MS = 60_000
// Negative results expire faster: a revoked/refreshed token is a different string,
// so a short window only suppresses re-verifying the exact same dead token.
const NEG_TOKEN_CACHE_TTL_MS = 30_000
const MAX_TOKEN_CACHE = 1000
const tokenCache = new Map<string, { user: SupabaseUser | null; expiresAt: number }>()

function cacheSet(token: string, user: SupabaseUser | null, ttlMs: number): void {
  if (tokenCache.size >= MAX_TOKEN_CACHE) tokenCache.clear()
  tokenCache.set(token, { user, expiresAt: Date.now() + ttlMs })
}

/**
 * Verify a Supabase access token (cached). Returns a discriminated outcome so
 * callers map unavailable vs invalid without try/catch ladders.
 */
export const verifySupabaseTokenOutcome = async (
  token: string,
  opts?: VerifyTokenOptions
): Promise<TokenVerifyOutcome> => {
  const now = Date.now()
  const cached = tokenCache.get(token)
  if (cached && cached.expiresAt > now) {
    return cached.user ? { kind: 'user', user: cached.user } : { kind: 'invalid' }
  }

  const getUser: AuthGetUser =
    opts?.getUser ??
    (async (accessToken) => {
      const supabase = getAnonClient()
      if (!supabase) {
        jwtLogger.error('Supabase anon client not configured')
        return { data: { user: null }, error: null }
      }
      return supabase.auth.getUser(accessToken)
    })

  try {
    const {
      data: { user },
      error
    } = await getUser(token)

    if (error || !user) {
      jwtLogger.warn({ error }, 'Token verification failed')
      if (error != null && isTransientAuthFailure(error)) {
        return { kind: 'unavailable', cause: error }
      }
      if (error != null) cacheSet(token, null, NEG_TOKEN_CACHE_TTL_MS)
      return { kind: 'invalid' }
    }

    const result: SupabaseUser = {
      sub: user.id,
      email: user.email,
      is_anonymous: user.is_anonymous,
      user_metadata: user.user_metadata as SupabaseUser['user_metadata']
    }

    cacheSet(token, result, TOKEN_CACHE_TTL_MS)
    jwtLogger.debug({ userId: user.id }, 'Token verified')
    return { kind: 'user', user: result }
  } catch (error) {
    // getUser threw (network/timeout) rather than returning an AuthError.
    jwtLogger.error({ err: error }, 'Error verifying token')
    return { kind: 'unavailable', cause: error }
  }
}

/**
 * Service-role gate for internal email/push endpoints. Constant-time key match;
 * fails closed when the key is unset so a misconfigured env can't open the relay.
 */
export function verifyServiceRole(authHeader: string | undefined): boolean {
  const serviceRoleKey = config.supabase.serviceRoleKey
  if (!serviceRoleKey) return false

  if (!authHeader) return false

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  return constantTimeEqual(token, serviceRoleKey)
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}
