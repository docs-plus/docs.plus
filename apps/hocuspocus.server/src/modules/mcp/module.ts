import type { Hono } from 'hono'

import { createConnectedAppsRouter } from './http/connectedApps'
import { createBearerCheck, createVerifiedMcpCall, type VerifiedMcpCall } from './http/controller'
import { createRouter, createWellKnownRouter } from './http/router'
import { createServerFactory } from './http/serverFactory'
import { createChatStore } from './infra/chatStore'
import { createGrantRedirects } from './infra/grantRedirects'
import { createRequestBudget, createToolBudget } from './infra/toolBudget'
import { createUsageRecorder } from './infra/usageStore'
import type { InitDeps } from './types'

export interface InitResult {
  router: Hono
  /** Serves the resource metadata at the root `.well-known` URLs too. */
  wellKnownRouter: Hono
  connectedAppsRouter: Hono
  /** For `setupMiddleware`: it shares the transport's bearer check, so a request verifies once. */
  isVerifiedMcpCall: VerifiedMcpCall
}

export const init = (deps: InitDeps): InitResult => {
  const endpoint = {
    publicBaseUrl: deps.publicBaseUrl,
    authIssuer: deps.authIssuer,
    allowedOrigins: deps.allowedOrigins
  }
  const checkBearer = createBearerCheck(deps.verifyToken)
  return {
    router: createRouter({
      ...endpoint,
      checkBearer,
      requestBudget: createRequestBudget(deps.redis, deps.logger),
      factory: createServerFactory({
        prisma: deps.prisma,
        logger: deps.logger,
        content: deps.content,
        budget: createToolBudget(deps.redis, deps.logger),
        usage: createUsageRecorder(deps.redis, deps.logger),
        chat: deps.supabase ? createChatStore(deps.supabase) : null,
        appUrl: deps.appUrl,
        version: deps.version
      })
    }),
    wellKnownRouter: createWellKnownRouter(endpoint),
    connectedAppsRouter: createConnectedAppsRouter(
      createGrantRedirects({
        supabase: deps.supabase,
        supabaseUrl: deps.supabaseUrl,
        supabaseKey: deps.supabaseKey,
        logger: deps.logger
      })
    ),
    isVerifiedMcpCall: createVerifiedMcpCall(checkBearer)
  }
}
