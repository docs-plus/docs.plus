import { zValidator } from '@hono/zod-validator'
import { type Context, Hono } from 'hono'

import { isIconOrigin } from '../domain/icon'
import type { ErrorResponse } from '../domain/types'
import type { ControllerDeps } from './controller'
import { createController } from './controller'
import { CLEAN_MISS_CACHE_HEADER, createIconController } from './iconController'
import { ICON_ORIGIN_MAX_LENGTH, iconQuerySchema, metadataQuerySchema } from './schema'

export const LINK_METADATA_MOUNT_PATH = '/api/metadata'
export const LINK_ICON_PATH = `${LINK_METADATA_MOUNT_PATH}/icon`

export type RouterDeps = ControllerDeps & { iconMaxBytes: number }

export const createRouter = (deps: RouterDeps): Hono => {
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
  router.get(
    '/icon',
    zValidator('query', iconQuerySchema, iconHook),
    createIconController({ iconMaxBytes: deps.iconMaxBytes })
  )
  return router
}

// On failure `result.data` is the raw query, so a repeated `origin` arrives as an array.
// A value that is a well-formed origin failed only the SSRF check.
const iconHook = (result: { success: boolean; data: unknown }, c: Context) => {
  if (result.success) return
  const origin = (result.data as { origin?: unknown }).origin
  const isInvalid =
    typeof origin !== 'string' || origin.length > ICON_ORIGIN_MAX_LENGTH || !isIconOrigin(origin)
  const body: ErrorResponse = isInvalid
    ? {
        success: false,
        code: 'INVALID_URL',
        message: 'origin query parameter must be a bare http(s) origin with no port'
      }
    : { success: false, code: 'BLOCKED_URL', message: 'origin is not allowed' }
  return c.json(body, 400, { 'Cache-Control': CLEAN_MISS_CACHE_HEADER })
}
