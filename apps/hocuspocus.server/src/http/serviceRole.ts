import type { MiddlewareHandler } from 'hono'

import { fail } from './envelope'

export type VerifyServiceRole = (authHeader: string | undefined) => boolean

/**
 * Register per route, never as a `use` wildcard: an unmatched wildcard gates the
 * routers mounted beside yours on the same prefix.
 */
export const requireServiceRole =
  (verifyServiceRole: VerifyServiceRole): MiddlewareHandler =>
  async (c, next) => {
    if (!verifyServiceRole(c.req.header('Authorization'))) {
      return fail(c, 401, 'UNAUTHORIZED', 'Service role authorization required')
    }
    await next()
  }
