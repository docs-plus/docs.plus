import { zValidator } from '@hono/zod-validator'
import { Hono, type MiddlewareHandler } from 'hono'
import { z } from 'zod'

import {
  extractToken,
  requireNonAnonymousUser,
  requireUser as defaultRequireUser
} from '../../../api/middleware/auth'
import { houseEnvelopeHook, ok } from '../../../http/envelope'
import type { ClientRedirects, GrantRedirects } from '../infra/grantRedirects'

const clientIdParamSchema = z.object({
  clientId: z.string().uuid()
})

const ANONYMOUS_REDIRECTS_ERROR = 'Anonymous users cannot read connected app redirects'

export interface ConnectedAppsDeps {
  grantRedirects: GrantRedirects
  clientRedirects: ClientRedirects
  /** Per-user limiter (30 / min). Optional so seam tests can omit or override it. */
  grantRedirectsRateLimit?: MiddlewareHandler
  /** Per-user limiter (30 / min). Optional so seam tests can omit or override it. */
  clientRedirectsRateLimit?: MiddlewareHandler
  requireUser?: MiddlewareHandler
}

export const createConnectedAppsRouter = (deps: ConnectedAppsDeps): Hono => {
  const router = new Hono()
  const requireUser = deps.requireUser ?? defaultRequireUser
  const grantRedirectsRateLimit: MiddlewareHandler =
    deps.grantRedirectsRateLimit ?? (async (_c, next) => next())
  const clientRedirectsRateLimit: MiddlewareHandler =
    deps.clientRedirectsRateLimit ?? (async (_c, next) => next())

  // requireUser refuses a connected app's own token, so an app cannot list its siblings.
  router.get(
    '/redirects',
    requireUser,
    requireNonAnonymousUser(ANONYMOUS_REDIRECTS_ERROR),
    grantRedirectsRateLimit,
    async (c) => ok(c, { redirects: await deps.grantRedirects(extractToken(c)) })
  )

  router.get(
    '/clients/:clientId/redirects',
    requireUser,
    requireNonAnonymousUser(ANONYMOUS_REDIRECTS_ERROR),
    zValidator('param', clientIdParamSchema, houseEnvelopeHook),
    clientRedirectsRateLimit,
    async (c) => {
      const clientId = c.req.param('clientId')
      return ok(c, { redirects: await deps.clientRedirects(clientId) })
    }
  )

  return router
}
