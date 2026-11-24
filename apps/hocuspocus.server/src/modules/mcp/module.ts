import type { Hono } from 'hono'

import { userRateLimiter } from '../../middleware'
import { createConnectedAppsRouter } from './http/connectedApps'
import { createBearerCheck, createMcpRateLimit, type McpRateLimit } from './http/controller'
import { createRouter, createWellKnownRouter } from './http/router'
import { createServerFactory } from './http/serverFactory'
import { createChatStore } from './infra/chatStore'
import { createClientRedirects, createGrantRedirects } from './infra/grantRedirects'
import { createRequestBudget, createToolBudget } from './infra/toolBudget'
import { createUsageRecorder } from './infra/usageStore'
import type { InitDeps } from './types'

export interface InitResult {
  router: Hono
  /** Serves the resource metadata at the root `.well-known` URLs too. */
  wellKnownRouter: Hono
  connectedAppsRouter: Hono
  /** For `setupMiddleware`: shares the transport's bearer check and charges `mcp-req`. */
  mcpRateLimit: McpRateLimit
  close: () => Promise<void>
}

export const init = (deps: InitDeps): InitResult => {
  const endpoint = {
    publicBaseUrl: deps.publicBaseUrl,
    authIssuer: deps.authIssuer,
    allowedOrigins: deps.allowedOrigins
  }
  const checkBearer = createBearerCheck(deps.verifyToken)
  const { router, close } = createRouter({
    ...endpoint,
    checkBearer,
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
  })
  return {
    router,
    wellKnownRouter: createWellKnownRouter(endpoint),
    connectedAppsRouter: createConnectedAppsRouter({
      grantRedirects: createGrantRedirects({
        supabase: deps.supabase,
        supabaseUrl: deps.supabaseUrl,
        supabaseAnonKey: deps.supabaseAnonKey,
        logger: deps.logger
      }),
      clientRedirects: createClientRedirects({
        supabase: deps.supabase,
        logger: deps.logger
      }),
      clientRedirectsRateLimit: userRateLimiter({
        points: 30,
        duration: 60,
        keyPrefix: 'mcp-client-redirects',
        storeClient: deps.redis
      })
    }),
    mcpRateLimit: createMcpRateLimit(checkBearer, createRequestBudget(deps.redis, deps.logger)),
    close
  }
}
