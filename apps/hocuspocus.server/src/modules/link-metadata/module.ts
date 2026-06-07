import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { RedisClient } from '../../types/redis.types'
import { runSpecialHandler } from './domain/stages/handlers'
import { runHtmlScrape } from './domain/stages/htmlScrape'
import { runOembed } from './domain/stages/oembed'
import { createRouter } from './http/router'
import { createMetascraper } from './infra/metascraper'
import { createRedisCache } from './infra/redisCache'

export interface InitDeps {
  redis: RedisClient | null
  logger: Logger
}

export interface InitResult {
  router: Hono
}

/**
 * Public wiring. Builds adapters, wires pipeline stages together, returns
 * a router the host can mount. No top-level side effects (boundary rule 6).
 */
export const init = (deps: InitDeps): InitResult => {
  const cache = createRedisCache(deps.redis)
  const scraper = createMetascraper()

  const stages = {
    oembed: runOembed,
    special: runSpecialHandler,
    html: runHtmlScrape
  }

  const router = createRouter({ cache, scraper, stages, logger: deps.logger })
  return { router }
}
