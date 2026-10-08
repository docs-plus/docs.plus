import type { Context, Next } from 'hono'

import { verifySupabaseTokenOutcome } from '../../lib/auth'
import { isConnectedAppToken } from '../../lib/jwtClaims'
import { adminLogger } from '../../lib/logger'
import { getSupabaseClient } from '../utils/supabase'

export async function adminAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.slice(7)
  const outcome = await verifySupabaseTokenOutcome(token)
  if (outcome.kind === 'unavailable') {
    return c.json({ error: 'Auth service temporarily unavailable' }, 503)
  }
  if (outcome.kind === 'invalid') {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
  if (outcome.kind !== 'user') {
    const _exhaustive: never = outcome
    return _exhaustive
  }

  // A connected app must never get admin power.
  if (isConnectedAppToken(token)) {
    return c.json({ error: 'Connected apps cannot use admin routes' }, 403)
  }

  const user = outcome.user
  const supabase = getSupabaseClient()

  if (!supabase) {
    adminLogger.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  try {
    const { data: adminData, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.sub)
      .maybeSingle()

    if (error) {
      adminLogger.error({ err: error }, 'Failed to check admin status')
      return c.json({ error: 'Failed to verify admin status' }, 500)
    }

    if (!adminData) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    c.set('user', user)
    c.set('userId', user.sub)

    await next()
    // Who did what. The request logger has no user.
    if (c.req.method !== 'GET') {
      adminLogger.info(
        {
          actorId: user.sub,
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          requestId: c.get('requestId')
        },
        'Admin action'
      )
    }
  } catch (error) {
    adminLogger.error({ err: error }, 'Admin auth middleware error')
    return c.json({ error: 'Authentication failed' }, 500)
  }
}
