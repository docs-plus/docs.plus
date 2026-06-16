import type { Context, Next } from 'hono'

import { verifySupabaseToken } from '../../lib/auth'

// Accept either `Authorization: Bearer <jwt>` or the `token` header the webapp
// already uses on document reads (fetchDocument.ts), so callers stay consistent.
const extractToken = (c: Context): string | undefined => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return c.req.header('token') || undefined
}

const unauthorized = (c: Context, message: string) =>
  c.json({ success: false, error: { message, code: 'UNAUTHORIZED' } }, 401)

/** Require a verified Supabase user. Sets `user`/`userId` for downstream handlers. */
export async function requireUser(c: Context, next: Next) {
  const token = extractToken(c)
  if (!token) return unauthorized(c, 'Authentication required')

  const user = await verifySupabaseToken(token)
  if (!user) return unauthorized(c, 'Invalid or expired token')

  c.set('user', user)
  c.set('userId', user.sub)
  await next()
}

/** Attach the user when a valid token is present; never rejects. For routes with
 *  mixed public/privileged actions that gate per-field downstream. */
export async function optionalUser(c: Context, next: Next) {
  const token = extractToken(c)
  if (token) {
    const user = await verifySupabaseToken(token)
    if (user) {
      c.set('user', user)
      c.set('userId', user.sub)
    }
  }
  await next()
}
