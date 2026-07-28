import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'

import { fail, houseEnvelopeHook, requireServiceRole } from '../../document-content/http/controller'
import type { VerifyServiceRole, VersionOps } from '../types'
import {
  createInternalCheckpointHandler,
  createInternalRestoreHandler,
  versionBodyLimit
} from './controller'
import { checkpointBodySchema, documentIdParamSchema, versionParamSchema } from './schema'

export interface InternalAppDeps {
  verifyServiceRole: VerifyServiceRole
  ops: VersionOps
}

/**
 * The WS process's internal version endpoints — POST only, because the reads
 * and the delete are plain Prisma and REST already holds the client. Never
 * Traefik-routed; `requestId()` adopts the caller's forwarded id across the hop.
 */
export const createInternalApp = (deps: InternalAppDeps): Hono => {
  const app = new Hono()
  const auth = requireServiceRole(deps.verifyServiceRole)
  const checkpointPath = '/internal/documents/:documentId/versions'
  const restorePath = '/internal/documents/:documentId/versions/:version/restore'

  app.use('*', requestId())

  app.post(
    checkpointPath,
    auth,
    versionBodyLimit(),
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('json', checkpointBodySchema, houseEnvelopeHook),
    createInternalCheckpointHandler(deps.ops)
  )

  app.post(
    restorePath,
    auth,
    versionBodyLimit(),
    zValidator('param', versionParamSchema, houseEnvelopeHook),
    createInternalRestoreHandler(deps.ops)
  )

  app.notFound((c) => fail(c, 404, 'NOT_FOUND', 'Not found'))

  return app
}
