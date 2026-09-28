import { Hono } from 'hono'

import { extractToken, requireUser } from '../../../api/middleware/auth'
import { ok } from '../../../http/envelope'
import type { GrantRedirects } from '../infra/grantRedirects'

export const createConnectedAppsRouter = (grantRedirects: GrantRedirects): Hono => {
  const router = new Hono()
  // requireUser refuses a connected app's own token, so an app cannot list its siblings.
  router.get('/redirects', requireUser, async (c) =>
    ok(c, { redirects: await grantRedirects(extractToken(c)) })
  )
  return router
}
