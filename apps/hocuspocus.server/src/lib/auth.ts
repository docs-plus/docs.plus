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

// Short-TTL cache: verifying a Supabase JWT is a network round-trip, and WS
// reconnect storms re-verify the same token repeatedly. 60s of staleness on a
// revoked token is an accepted trade for not hammering Supabase Auth.
const TOKEN_CACHE_TTL_MS = 60_000
// Negative results expire faster: a revoked/refreshed token is a different string,
// so a short window only suppresses re-verifying the exact same dead token.
const NEG_TOKEN_CACHE_TTL_MS = 30_000
const MAX_TOKEN_CACHE = 1000
const tokenCache = new Map<string, { user: SupabaseUser | null; expiresAt: number }>()

/**
 * Verify a Supabase access token (cached for a short window).
 */
export const verifySupabaseToken = async (token: string): Promise<SupabaseUser | null> => {
  const now = Date.now()
  const cached = tokenCache.get(token)
  if (cached && cached.expiresAt > now) return cached.user

  const supabase = getAnonClient()
  if (!supabase) {
    jwtLogger.error('Supabase anon client not configured')
    return null
  }

  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      jwtLogger.warn({ error }, 'Token verification failed')
      // Negative-cache ONLY a definitively-invalid token (a status-bearing 4xx like an
      // expired/revoked JWT) so a storm with the same dead token stops re-hitting
      // Supabase. auth-js RETURNS (not throws) an AuthError for transient 429/5xx/network/
      // unknown(status-less) too; caching those would strand a VALID user mid-storm.
      const status = error?.status
      const definitive =
        error != null &&
        !isAuthRetryableFetchError(error) &&
        status != null &&
        status !== 429 &&
        status < 500
      if (definitive) {
        if (tokenCache.size >= MAX_TOKEN_CACHE) tokenCache.clear()
        tokenCache.set(token, { user: null, expiresAt: now + NEG_TOKEN_CACHE_TTL_MS })
      }
      return null
    }

    const result: SupabaseUser = {
      sub: user.id,
      email: user.email,
      is_anonymous: user.is_anonymous,
      user_metadata: user.user_metadata as SupabaseUser['user_metadata']
    }

    if (tokenCache.size >= MAX_TOKEN_CACHE) tokenCache.clear()
    tokenCache.set(token, { user: result, expiresAt: now + TOKEN_CACHE_TTL_MS })

    jwtLogger.debug({ userId: user.id }, 'Token verified')
    return result
  } catch (error) {
    jwtLogger.error({ err: error }, 'Error verifying token')
    return null
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
