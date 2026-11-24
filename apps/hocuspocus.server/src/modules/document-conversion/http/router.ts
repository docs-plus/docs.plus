import { zValidator } from '@hono/zod-validator'
import { Hono, type MiddlewareHandler } from 'hono'
import type { Logger } from 'pino'

import { optionalPadReader, requireServiceRoleOrUser } from '../../../api/middleware/auth'
import type { PrismaClient } from '../../../generated/prisma/client'
import { houseEnvelopeHook } from '../../../http/envelope'
import { documentIdParamSchema } from '../../document-content/http/schema'
import {
  createGetExportHandler,
  createGetMarkdownHandler,
  createPostImportHandler
} from './controller'
import { exportQuerySchema } from './schema'

export const DOCUMENT_CONVERSION_MOUNT_PATH = '/api/documents'
const MARKDOWN_READ_ROUTE = '/:slug/markdown'
const MARKDOWN_READ_PATH = new RegExp(`^${DOCUMENT_CONVERSION_MOUNT_PATH}/[^/]+/markdown$`)

/** The rate limiter gives the public Markdown route its own bucket, off the global pool. */
export const isMarkdownReadPath = (path: string): boolean => MARKDOWN_READ_PATH.test(path)

export interface RouterDeps {
  prisma: PrismaClient
  logger: Logger
  mediaPublicBaseUrl: string | null
  mediaCookieFor: (uid: string) => string | null
  /** optionalUser with the #596 Auth deadline, for `GET /:slug/markdown`. */
  optionalPadReader?: MiddlewareHandler
}

/**
 * All paths are two-segment, so none can shadow the legacy `/:docName` read.
 * The auth check is per-route rather than a `use` pattern: a pattern that fails
 * to match leaves the route open, and nothing would say so. It only proves who
 * the caller is — the handlers gate access off the document row they load.
 */
export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()

  router.get(
    MARKDOWN_READ_ROUTE,
    deps.optionalPadReader ?? optionalPadReader,
    createGetMarkdownHandler({
      prisma: deps.prisma,
      logger: deps.logger
    })
  )

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
