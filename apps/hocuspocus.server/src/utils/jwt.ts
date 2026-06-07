import { createClient } from '@supabase/supabase-js'

import { jwtLogger } from '../lib/logger'

/**
 * Supabase user data from token verification
 */
export interface SupabaseUser {
  sub: string
  email?: string
  user_metadata?: {
    full_name?: string
    name?: string
    avatar_url?: string
  }
}

/**
 * Verify Supabase access token via API
 */
export const verifySupabaseToken = async (token: string): Promise<SupabaseUser | null> => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    jwtLogger.error('SUPABASE_URL or SUPABASE_ANON_KEY not configured')
    return null
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      jwtLogger.warn({ error }, 'Token verification failed')
      return null
    }

    jwtLogger.debug({ userId: user.id }, 'Token verified')

    return {
      sub: user.id,
      email: user.email,
      user_metadata: user.user_metadata as SupabaseUser['user_metadata']
    }
  } catch (error) {
    jwtLogger.error({ err: error }, 'Error verifying token')
    return null
  }
}

// Alias for backward compatibility
export const verifyJWT = verifySupabaseToken
