import type { Context, Next } from 'hono'

import { verifyServiceRole, verifySupabaseTokenOutcome } from '../../lib/auth'

// Accept either `Authorization: Bearer <jwt>` or the `token` header the webapp
// already uses on document reads (fetchDocument.ts), so callers stay consistent.
const extractToken = (c: Context): string | undefined => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return c.req.header('token') || undefined
}

const unauthorized = (c: Context, message: string) =>
  c.json({ success: false, error: { message, code: 'UNAUTHORIZED' } }, 401)

export const authUnavailableResponse = (c: Context) =>
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
      return authUnavailableResponse(c)
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

/** Service-role first — the key is not a JWT and would fail `requireUser`. Sets
 *  `serviceRole` so handlers can gate the privileged fields on it. */
export async function requireServiceRoleOrUser(c: Context, next: Next) {
  if (verifyServiceRole(c.req.header('Authorization'))) {
    c.set('serviceRole', true)
    await next()
    return
  }
  return requireUser(c, next)
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
    } else if (outcome.kind === 'unavailable') {
      // An owner degraded to anonymous reads as sign-in-required on their own
      // private document. Record it so the private gate can answer 503 instead.
      c.set('authUnavailable', true)
    }
  }
  await next()
}
