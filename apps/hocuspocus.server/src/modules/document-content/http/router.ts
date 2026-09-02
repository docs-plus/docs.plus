import { zValidator } from '@hono/zod-validator'
import type { PrismaClient } from '@prisma/client'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { houseEnvelopeHook } from '../../../http/envelope'
import { requireServiceRole } from '../../../http/serviceRole'
import type { WsApplyClient } from '../infra/wsApplyClient'
import type { VerifyServiceRole } from '../types'
import { contentBodyLimit, createGetContentHandler, createPatchContentHandler } from './controller'
import {
  contentQuerySchema,
  documentIdParamSchema,
  patchBodySchema,
  patchQuerySchema
} from './schema'

export interface RouterDeps {
  prisma: PrismaClient
  logger: Logger
  verifyServiceRole: VerifyServiceRole
  wsApply: WsApplyClient
}

/** Content routes are two-segment, so they can never shadow the legacy `/:docName` read. */
export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()
  const contentPath = '/:documentId/content'

  router.use(contentPath, requireServiceRole(deps.verifyServiceRole))

  router.get(
    contentPath,
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('query', contentQuerySchema, houseEnvelopeHook),
    createGetContentHandler({ prisma: deps.prisma, logger: deps.logger })
  )

  router.patch(
    contentPath,
    contentBodyLimit(),
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('query', patchQuerySchema, houseEnvelopeHook),
    zValidator('json', patchBodySchema, houseEnvelopeHook),
    createPatchContentHandler({ prisma: deps.prisma, wsApply: deps.wsApply })
  )

  return router
}
