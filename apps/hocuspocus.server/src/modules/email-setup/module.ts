import type { Hono } from 'hono'

import { createRouter } from './http/router'
import { createLatestBounceReader } from './infra/latestBounceReader'
import { createTestSendBudget } from './infra/testSendBudget'
import type { InitDeps } from './types'

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => ({
  router: createRouter(deps.adminAuth, {
    delivery: deps.delivery,
    facts: deps.facts,
    getEmailProvider: deps.getEmailProvider,
    deliverEmail: deps.deliverEmail,
    getEmailQueueHealth: deps.getEmailQueueHealth,
    getEmailDlqDepth: deps.getEmailDlqDepth,
    getLatestBounce: createLatestBounceReader(deps.supabase),
    testSendBudget: createTestSendBudget(deps.redis, deps.logger),
    logger: deps.logger
  })
})
