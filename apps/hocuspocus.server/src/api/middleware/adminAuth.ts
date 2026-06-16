import type { Context, Next } from 'hono'

import { verifySupabaseToken } from '../../lib/auth'
import { adminLogger } from '../../lib/logger'
import { getSupabaseClient } from '../utils/supabase'

/** Require a verified Supabase user that is also present in `admin_users`. */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.slice(7)

  const user = await verifySupabaseToken(token)

  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

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
  } catch (error) {
    adminLogger.error({ err: error }, 'Admin auth middleware error')
    return c.json({ error: 'Authentication failed' }, 500)
  }
}
