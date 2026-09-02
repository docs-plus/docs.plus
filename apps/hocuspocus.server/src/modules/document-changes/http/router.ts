import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { houseEnvelopeHook } from '../../../http/envelope'
import { requireServiceRole } from '../../../http/serviceRole'
import type { ComputeDocumentChanges, VerifyServiceRole } from '../types'
import { createChangesHandler } from './controller'
import { changesQuerySchema, documentIdParamSchema } from './schema'

export interface RouterDeps {
  compute: ComputeDocumentChanges
  logger: Logger
  verifyServiceRole: VerifyServiceRole
}

/**
 * Two segments, so it can never shadow the legacy single-segment `/:docName`
 * read. Auth is per-route: a `use` wildcard here would gate the routers mounted
 * beside this one on the same prefix.
 */
export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()

  router.get(
    '/:documentId/changes',
    requireServiceRole(deps.verifyServiceRole),
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('query', changesQuerySchema, houseEnvelopeHook),
    createChangesHandler({ compute: deps.compute, logger: deps.logger })
  )

  return router
}
