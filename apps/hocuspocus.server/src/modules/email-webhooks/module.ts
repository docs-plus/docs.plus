import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { EmailBounceEvent } from '../../types/email.types'
import type { RedisClient } from '../../types/redis.types'
import { createRouter } from './http/router'
import { createWebhookDedupe } from './infra/webhookDedupe'

export interface InitDeps {
  /** A secret `resolveWebhookSecret` accepted. The caller mounts nothing without one. */
  webhookSecret: string
  /** This server's `ns` tag in Resend's cleaned form, or null when email is not ready. */
  namespaceTag: string | null
  redis: RedisClient | null
  recordEmailBounce: (event: EmailBounceEvent) => Promise<unknown>
  logger: Logger
}

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => ({
  router: createRouter({
    webhookSecret: deps.webhookSecret,
    namespaceTag: deps.namespaceTag,
    dedupe: createWebhookDedupe(deps.redis),
    recordEmailBounce: deps.recordEmailBounce,
    logger: deps.logger
  })
})
