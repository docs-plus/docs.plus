import { Hono } from 'hono'

import type { ControllerDeps } from './controller'
import { createController, webhookBodyLimit } from './controller'

/** Mounted at `/api/email/webhooks`. One route per provider. */
export const createRouter = (deps: ControllerDeps): Hono => {
  const router = new Hono()
  router.post('/resend', webhookBodyLimit, createController(deps))
  return router
}
