import type { Context, Next } from 'hono'

import { adminLogger } from '../../lib/logger'
import { verifySupabaseToken } from '../../utils/jwt'
import { getSupabaseClient } from '../utils/supabase'

/**
 * Admin authentication middleware
 * Verifies the user is authenticated and has admin access via admin_users table
 */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  // Check for Authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.slice(7)

  // Verify the token with Supabase
  const user = await verifySupabaseToken(token)

  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Check if user exists in admin_users table
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

    // Store user info in context for downstream handlers
    c.set('user', user)
    c.set('userId', user.sub)

    await next()
  } catch (error) {
    adminLogger.error({ err: error }, 'Admin auth middleware error')
    return c.json({ error: 'Authentication failed' }, 500)
  }
}
