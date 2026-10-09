import { Hono, type MiddlewareHandler } from 'hono'

import type { ControllerDeps } from './controller'
import { createGetSetup, createTestSend } from './controller'

/** Mounted at `/api/admin/email/setup`, ahead of the admin router. */
export const createRouter = (adminAuth: MiddlewareHandler, deps: ControllerDeps): Hono => {
  const router = new Hono()
  router.use('*', adminAuth)
  router.get('/', createGetSetup(deps))
  router.post('/test-send', createTestSend(deps))
  return router
}
