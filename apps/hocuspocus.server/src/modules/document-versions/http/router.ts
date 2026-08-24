import { zValidator } from '@hono/zod-validator'
import type { PrismaClient } from '@prisma/client'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { houseEnvelopeHook } from '../../../http/envelope'
import { requireServiceRole } from '../../document-content/http/controller'
import type { WsVersionsClient } from '../infra/wsVersionsClient'
import type { GetOwnerProfiles, VerifyServiceRole } from '../types'
import {
  createCheckpointHandler,
  createDeleteVersionHandler,
  createDiffHandler,
  createGetVersionHandler,
  createListVersionsHandler,
  createRestoreHandler,
  versionBodyLimit
} from './controller'
import {
  checkpointBodySchema,
  contentQuerySchema,
  diffQuerySchema,
  documentIdParamSchema,
  listQuerySchema,
  versionParamSchema
} from './schema'

export interface RouterDeps {
  prisma: PrismaClient
  logger: Logger
  verifyServiceRole: VerifyServiceRole
  getOwnerProfiles: GetOwnerProfiles
  wsVersions: WsVersionsClient
}

/**
 * Version routes are two segments or more, so they can never shadow the legacy
 * `/:docName` read. Auth is per-route rather than a `use` prefix: an unmatched
 * wildcard here would gate the routers mounted beside this one.
 */
export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()
  const auth = requireServiceRole(deps.verifyServiceRole)
  const listPath = '/:documentId/versions'
  const versionPath = '/:documentId/versions/:version'
  const diffPath = '/:documentId/versions/:version/diff'
  const restorePath = '/:documentId/versions/:version/restore'

  router.get(
    listPath,
    auth,
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('query', listQuerySchema, houseEnvelopeHook),
    createListVersionsHandler({
      prisma: deps.prisma,
      logger: deps.logger,
      getOwnerProfiles: deps.getOwnerProfiles
    })
  )

  router.post(
    listPath,
    auth,
    versionBodyLimit(),
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('json', checkpointBodySchema, houseEnvelopeHook),
    createCheckpointHandler({ prisma: deps.prisma, wsVersions: deps.wsVersions })
  )

  router.get(
    versionPath,
    auth,
    zValidator('param', versionParamSchema, houseEnvelopeHook),
    zValidator('query', contentQuerySchema, houseEnvelopeHook),
    createGetVersionHandler({ prisma: deps.prisma, logger: deps.logger })
  )

  router.get(
    diffPath,
    auth,
    zValidator('param', versionParamSchema, houseEnvelopeHook),
    zValidator('query', diffQuerySchema, houseEnvelopeHook),
    createDiffHandler({
      prisma: deps.prisma,
      logger: deps.logger,
      getOwnerProfiles: deps.getOwnerProfiles
    })
  )

  router.delete(
    versionPath,
    auth,
    zValidator('param', versionParamSchema, houseEnvelopeHook),
    createDeleteVersionHandler({ prisma: deps.prisma })
  )

  router.post(
    restorePath,
    auth,
    versionBodyLimit(),
    zValidator('param', versionParamSchema, houseEnvelopeHook),
    createRestoreHandler({ prisma: deps.prisma, wsVersions: deps.wsVersions })
  )

  return router
}
