import type { Context, Next } from 'hono'

import { verifySupabaseTokenOutcome } from '../../lib/auth'

// Accept either `Authorization: Bearer <jwt>` or the `token` header the webapp
// already uses on document reads (fetchDocument.ts), so callers stay consistent.
const extractToken = (c: Context): string | undefined => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return c.req.header('token') || undefined
}

const unauthorized = (c: Context, message: string) =>
  c.json({ success: false, error: { message, code: 'UNAUTHORIZED' } }, 401)

const authUnavailable = (c: Context) =>
  c.json(
    {
      success: false,
      error: { message: 'Auth service temporarily unavailable', code: 'AUTH_UNAVAILABLE' }
    },
    503
  )

/** Require a verified Supabase user. Sets `user`/`userId` for downstream handlers. */
export async function requireUser(c: Context, next: Next) {
  const token = extractToken(c)
  if (!token) return unauthorized(c, 'Authentication required')

  const outcome = await verifySupabaseTokenOutcome(token)
  switch (outcome.kind) {
    case 'unavailable':
      return authUnavailable(c)
    case 'invalid':
      return unauthorized(c, 'Invalid or expired token')
    case 'user':
      c.set('user', outcome.user)
      c.set('userId', outcome.user.sub)
      await next()
      return
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

/** Attach the user when a valid token is present; never rejects. For routes with
 *  mixed public/privileged actions that gate per-field downstream. */
export async function optionalUser(c: Context, next: Next) {
  const token = extractToken(c)
  if (token) {
    const outcome = await verifySupabaseTokenOutcome(token)
    // Transient outage → proceed anonymous; only a verified user is attached.
    if (outcome.kind === 'user') {
      c.set('user', outcome.user)
      c.set('userId', outcome.user.sub)
    }
  }
  await next()
}
