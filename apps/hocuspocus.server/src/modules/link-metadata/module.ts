import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { RedisClient } from '../../types/redis.types'
import { ICON_MAX_BYTES_DEFAULT } from './domain/icon'
import { runSpecialHandler } from './domain/stages/handlers'
import { runHtmlScrape } from './domain/stages/htmlScrape'
import { runOembed } from './domain/stages/oembed'
import { createRouter } from './http/router'
import { createMetascraper } from './infra/metascraper'
import { createRedisCache } from './infra/redisCache'

export interface InitDeps {
  redis: RedisClient | null
  logger: Logger
  iconMaxBytes?: number
}

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => {
  const cache = createRedisCache(deps.redis)
  const scraper = createMetascraper()

  const stages = {
    oembed: runOembed,
    special: runSpecialHandler,
    html: runHtmlScrape
  }

  const router = createRouter({
    cache,
    scraper,
    stages,
    logger: deps.logger,
    iconMaxBytes: deps.iconMaxBytes ?? ICON_MAX_BYTES_DEFAULT
  })
  return { router }
}
