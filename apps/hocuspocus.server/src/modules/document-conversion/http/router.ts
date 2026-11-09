import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { requireServiceRoleOrUser } from '../../../api/middleware/auth'
import type { PrismaClient } from '../../../generated/prisma/client'
import { houseEnvelopeHook } from '../../../http/envelope'
import { documentIdParamSchema } from '../../document-content/http/schema'
import { createGetExportHandler, createPostImportHandler } from './controller'
import { exportQuerySchema } from './schema'

export interface RouterDeps {
  prisma: PrismaClient
  logger: Logger
  mediaPublicBaseUrl: string | null
  mediaCookieFor: (uid: string) => string | null
}

/**
 * Both paths are two-segment, so neither can shadow the legacy `/:docName` read.
 * The auth check is per-route rather than a `use` pattern: a pattern that fails
 * to match leaves the route open, and nothing would say so. It only proves who
 * the caller is — the handlers gate access off the document row they load.
 */
export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()

  router.get(
    '/:documentId/export',
    requireServiceRoleOrUser,
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('query', exportQuerySchema, houseEnvelopeHook),
    createGetExportHandler({
      prisma: deps.prisma,
      logger: deps.logger,
      mediaPublicBaseUrl: deps.mediaPublicBaseUrl,
      mediaCookieFor: deps.mediaCookieFor
    })
  )

  router.post(
    '/:documentId/import',
    requireServiceRoleOrUser,
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    createPostImportHandler({
      prisma: deps.prisma,
      logger: deps.logger,
      mediaPublicBaseUrl: deps.mediaPublicBaseUrl
    })
  )

  return router
}
