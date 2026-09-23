import type { Hono } from 'hono'

import { createInternalApp } from './http/internalApp'
import { createRouter } from './http/router'
import { createContentClient } from './infra/contentClient'
import { createApplyContent } from './infra/hocuspocusApply'
import type { InitDeps, InitWsApplyDeps } from './types'

export interface InitResult {
  router: Hono
}

export interface InitWsApplyResult {
  app: Hono
}

export const init = (deps: InitDeps): InitResult => {
  const content = createContentClient({
    baseUrl: deps.wsApplyBaseUrl,
    serviceRoleKey: deps.serviceRoleKey,
    prisma: deps.prisma,
    logger: deps.logger
  })

  return {
    router: createRouter({
      prisma: deps.prisma,
      logger: deps.logger,
      verifyServiceRole: deps.verifyServiceRole,
      content
    })
  }
}

/** Content injection has to run where the live Y.Doc is; the collab process serves this app. */
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
      hocuspocus: deps.hocuspocus,
      prisma: deps.prisma,
      logger: deps.logger
    })
  }
}
