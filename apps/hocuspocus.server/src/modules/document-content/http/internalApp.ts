import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'

import type { ApplyContent } from '../infra/hocuspocusApply'
import type { VerifyServiceRole } from '../types'
import { INTERNAL_BODY_HEADROOM_BYTES, MAX_CONTENT_BYTES } from '../types'
import {
  contentBodyLimit,
  createInternalApplyHandler,
  fail,
  houseEnvelopeHook,
  requireServiceRole
} from './controller'
import { documentIdParamSchema, internalApplyBodySchema } from './schema'

export interface InternalAppDeps {
  verifyServiceRole: VerifyServiceRole
  applyContent: ApplyContent
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

  return app
}
