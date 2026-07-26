import { zValidator } from '@hono/zod-validator'
import type { PrismaClient } from '@prisma/client'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'

import { requireServiceRoleOrUser } from '../../../api/middleware/auth'
import { fail, houseEnvelopeHook } from '../../document-content/http/controller'
import { documentIdParamSchema } from '../../document-content/http/schema'
import { MAX_IMPORT_BYTES } from '../types'
import { createGetExportHandler, createPostImportHandler } from './controller'
import { exportQuerySchema } from './schema'

export interface RouterDeps {
  prisma: PrismaClient
  logger: Logger
  mediaPublicBaseUrl: string | null
}

// Sized above the file cap so multipart boundary and header overhead cannot turn
// an upload exactly at the limit into the blunt streaming 413.
const uploadBodyLimit = bodyLimit({
  maxSize: MAX_IMPORT_BYTES + 1_048_576,
  onError: (c) =>
    fail(c, 413, 'PAYLOAD_TOO_LARGE', `The upload exceeds the ${MAX_IMPORT_BYTES}-byte limit`)
})

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
      mediaPublicBaseUrl: deps.mediaPublicBaseUrl
    })
  )

  router.post(
    '/:documentId/import',
    requireServiceRoleOrUser,
    uploadBodyLimit,
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    createPostImportHandler({
      prisma: deps.prisma,
      logger: deps.logger,
      mediaPublicBaseUrl: deps.mediaPublicBaseUrl
    })
  )

  return router
}
