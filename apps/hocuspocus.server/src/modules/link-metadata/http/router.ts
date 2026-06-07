import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import type { ErrorResponse } from '../domain/types'
import type { ControllerDeps } from './controller'
import { createController } from './controller'
import { metadataQuerySchema } from './schema'

export const createRouter = (deps: ControllerDeps): Hono => {
  const router = new Hono()
  router.get(
    '/',
    // Custom error hook so a missing/malformed `?url=` returns the same
    // ErrorResponse shape as the controller's hand-rolled errors. Without
    // this, @hono/zod-validator emits its own `{ success:false, error }`
    // body and the client's discriminated union silently swallows it.
    zValidator('query', metadataQuerySchema, (result, c) => {
      if (!result.success) {
        const body: ErrorResponse = {
          success: false,
          code: 'INVALID_URL',
          message: 'url query parameter is required and must be a valid http(s) URL'
        }
        return c.json(body, 400)
      }
    }),
    createController(deps)
  )
  return router
}
