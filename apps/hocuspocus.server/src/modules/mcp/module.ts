import type { Hono } from 'hono'

import { createRouter } from './http/router'
import { createServerFactory } from './http/serverFactory'
import { createChatStore } from './infra/chatStore'
import { createToolBudget } from './infra/toolBudget'
import { createUsageRecorder } from './infra/usageStore'
import type { InitDeps } from './types'

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => ({
  router: createRouter({
    publicBaseUrl: deps.publicBaseUrl,
    authIssuer: deps.authIssuer,
    allowedOrigins: deps.allowedOrigins,
    verifyToken: deps.verifyToken,
    factory: createServerFactory({
      prisma: deps.prisma,
      logger: deps.logger,
      content: deps.content,
      budget: createToolBudget(deps.redis, deps.logger),
      usage: createUsageRecorder(deps.redis, deps.logger),
      chat: deps.supabase ? createChatStore(deps.supabase) : null,
      version: deps.version
    })
  })
})
