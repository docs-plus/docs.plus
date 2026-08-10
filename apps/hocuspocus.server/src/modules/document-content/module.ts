import type { Hono } from 'hono'

import { createInternalApp } from './http/internalApp'
import { createRouter } from './http/router'
import { createApplyContent } from './infra/hocuspocusApply'
import { createWsApplyClient } from './infra/wsApplyClient'
import type { InitDeps, InitWsApplyDeps } from './types'

export interface InitResult {
  router: Hono
}

export interface InitWsApplyResult {
  app: Hono
}

/** REST-process wiring: public content routes that forward applies over the internal hop. */
export const init = (deps: InitDeps): InitResult => {
  const wsApply = createWsApplyClient({
    baseUrl: deps.wsApplyBaseUrl,
    serviceRoleKey: deps.serviceRoleKey,
    logger: deps.logger
  })

  return {
    router: createRouter({
      prisma: deps.prisma,
      logger: deps.logger,
      verifyServiceRole: deps.verifyServiceRole,
      wsApply
    })
  }
}

/**
 * WS-process wiring — a deliberate second factory. Content injection has to run
 * where the live Y.Doc lives. This module owns an app the collab process serves
 * on its internal listener alongside `/metrics`.
 */
export const initWsApply = (deps: InitWsApplyDeps): InitWsApplyResult => {
  const applyContent = createApplyContent({
    hocuspocus: deps.hocuspocus,
    prisma: deps.prisma,
    logger: deps.logger
  })

  return {
    app: createInternalApp({
      verifyServiceRole: deps.verifyServiceRole,
      applyContent,
      logger: deps.logger
    })
  }
}
