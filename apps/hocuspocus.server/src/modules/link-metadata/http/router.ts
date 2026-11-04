import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { LINK_ARCHIVE_ROUTE, LINK_ICON_ROUTE, LINK_IMAGE_ROUTE } from '../domain/routes'
import type { ArchiveCache, ErrorResponse } from '../domain/types'
import { createArchiveController } from './archiveController'
import type { ControllerDeps } from './controller'
import { createController } from './controller'
import { CLEAN_MISS_CACHE_HEADER, createIconController } from './iconController'
import { createImageController } from './imageController'
import { iconQuerySchema, metadataQuerySchema } from './schema'

export type RouterDeps = ControllerDeps & { iconMaxBytes: number; archiveCache: ArchiveCache }

// Custom error hook so a missing/malformed `?url=` returns the same
// ErrorResponse shape as the controller's hand-rolled errors. Without
// this, @hono/zod-validator emits its own `{ success:false, error }`
// body and the client's discriminated union silently swallows it.
const validPageUrl = zValidator('query', metadataQuerySchema, (result, c) => {
  if (!result.success) {
    const body: ErrorResponse = {
      success: false,
      code: 'INVALID_URL',
      message: 'url query parameter is required and must be a valid http(s) URL'
    }
    return c.json(body, 400)
  }
})

export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()
  router.get('/', validPageUrl, createController(deps))
  router.get(LINK_IMAGE_ROUTE, validPageUrl, createImageController(deps))
  router.get(LINK_ARCHIVE_ROUTE, validPageUrl, createArchiveController(deps))
  router.get(
    LINK_ICON_ROUTE,
    // The schema tags the SSRF refine BLOCKED_URL. Every other first issue means a malformed origin.
    zValidator('query', iconQuerySchema, (result, c) => {
      if (result.success) return
      const body: ErrorResponse =
        result.error.issues[0]?.message === 'BLOCKED_URL'
          ? { success: false, code: 'BLOCKED_URL', message: 'origin is not allowed' }
          : {
              success: false,
              code: 'INVALID_URL',
              message: 'origin query parameter must be a bare http(s) origin with no port'
            }
      return c.json(body, 400, { 'Cache-Control': CLEAN_MISS_CACHE_HEADER })
    }),
    createIconController({ iconMaxBytes: deps.iconMaxBytes })
  )
  return router
}
