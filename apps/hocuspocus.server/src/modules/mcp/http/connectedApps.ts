import { zValidator } from '@hono/zod-validator'
import { Hono, type MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { extractToken, requireUser as defaultRequireUser } from '../../../api/middleware/auth'
import { fail, houseEnvelopeHook, ok } from '../../../http/envelope'
import type { ClientRedirects, GrantRedirects } from '../infra/grantRedirects'
import type { CallerBudget } from '../types'

const clientIdParamSchema = z.object({
  clientId: z.string().uuid()
})

export interface ConnectedAppsDeps {
  grantRedirects: GrantRedirects
  clientRedirects: ClientRedirects
  clientRedirectsBudget: CallerBudget
  requireUser?: MiddlewareHandler
}

export const createConnectedAppsRouter = (deps: ConnectedAppsDeps): Hono => {
  const router = new Hono()
  const requireUser = deps.requireUser ?? defaultRequireUser

  // requireUser refuses a connected app's own token, so an app cannot list its siblings.
  router.get('/redirects', requireUser, async (c) =>
    ok(c, { redirects: await deps.grantRedirects(extractToken(c)) })
  )

  router.get(
    '/clients/:clientId/redirects',
    requireUser,
    async (c, next) => {
      const userId = c.get('userId')
      if (!userId || c.get('user')?.is_anonymous) {
        return fail(c, 403, 'FORBIDDEN', 'Anonymous users cannot read connected app redirects')
      }
      await next()
    },
    zValidator('param', clientIdParamSchema, houseEnvelopeHook),
    async (c) => {
      const userId = c.get('userId')
      if (!userId) {
        return fail(c, 403, 'FORBIDDEN', 'Anonymous users cannot read connected app redirects')
      }
      const budget = await deps.clientRedirectsBudget(userId)
      if (!budget.ok) {
        c.header('Retry-After', budget.retryAfter.toString())
        return fail(c, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later')
      }
      const { clientId } = c.req.valid('param' as never) as { clientId: string }
      return ok(c, { redirects: await deps.clientRedirects(clientId) })
    }
  )

  return router
}
