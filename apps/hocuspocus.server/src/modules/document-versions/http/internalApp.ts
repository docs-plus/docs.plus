import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import type { Logger } from 'pino'

import { fail, houseEnvelopeHook } from '../../../http/envelope'
import { requireServiceRole } from '../../../http/serviceRole'
import { captureUnknown } from '../../../lib/instrument'
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
  logger: Logger
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

  // Hono answers an unhandled throw with an unstructured text/plain 500 the hop
  // reports as an empty body. The HTTPException arm comes first because
  // zValidator throws one for malformed JSON — that is a 400, not our bug.
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    const requestId = c.get('requestId') as string | undefined
    deps.logger.error({ err, requestId, path: c.req.path }, 'Internal version op threw')
    captureUnknown(err, { extra: { requestId, path: c.req.path } })
    return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  })

  return app
}
