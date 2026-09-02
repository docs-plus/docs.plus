import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import type { Logger } from 'pino'

import { fail, houseEnvelopeHook } from '../../../http/envelope'
import { requireServiceRole } from '../../../http/serviceRole'
import { captureUnknown } from '../../../lib/instrument'
import type { ApplyContent } from '../infra/hocuspocusApply'
import type { VerifyServiceRole } from '../types'
import { INTERNAL_BODY_HEADROOM_BYTES, MAX_CONTENT_BYTES } from '../types'
import { contentBodyLimit, createInternalApplyHandler } from './controller'
import { documentIdParamSchema, internalApplyBodySchema } from './schema'

export interface InternalAppDeps {
  verifyServiceRole: VerifyServiceRole
  applyContent: ApplyContent
  logger: Logger
}

/**
 * The WS process's internal apply endpoint. Never Traefik-routed; REST reaches
 * it over the docker network. `requestId()` adopts the caller's forwarded
 * `X-Request-Id` so an incident is traceable across the hop.
 */
export const createInternalApp = (deps: InternalAppDeps): Hono => {
  const app = new Hono()
  const applyPath = '/internal/documents/:documentId/content'

  app.use('*', requestId())
  app.use(applyPath, requireServiceRole(deps.verifyServiceRole))

  app.post(
    applyPath,
    contentBodyLimit(MAX_CONTENT_BYTES + INTERNAL_BODY_HEADROOM_BYTES),
    zValidator('param', documentIdParamSchema, houseEnvelopeHook),
    zValidator('json', internalApplyBodySchema, houseEnvelopeHook),
    createInternalApplyHandler(deps.applyContent)
  )

  app.notFound((c) => fail(c, 404, 'NOT_FOUND', 'Not found'))

  // Hono answers an unhandled throw with an unstructured text/plain 500 the hop
  // reports as an empty body. The HTTPException arm comes first because
  // zValidator throws one for malformed JSON — that is a 400, not our bug.
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    const requestId = c.get('requestId') as string | undefined
    deps.logger.error({ err, requestId, path: c.req.path }, 'Internal apply threw')
    captureUnknown(err, { extra: { requestId, path: c.req.path } })
    return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  })

  return app
}
