import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { RedisClient } from '../../types/redis.types'
import { ICON_MAX_BYTES_DEFAULT } from './domain/icon'
import { runSpecialHandler } from './domain/stages/handlers'
import { runHtmlScrape } from './domain/stages/htmlScrape'
import { runOembed } from './domain/stages/oembed'
import type { OwnImage } from './domain/types'
import { createRouter } from './http/router'
import { createHeadScraper } from './infra/headScraper'
import { createRedisCache } from './infra/redisCache'

export interface InitDeps {
  redis: RedisClient | null
  logger: Logger
  iconMaxBytes?: number
  publicUrl?: string | null
  ownImage?: OwnImage
}

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => {
  const cache = createRedisCache(deps.redis)
  const scraper = createHeadScraper()

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
    iconMaxBytes: deps.iconMaxBytes ?? ICON_MAX_BYTES_DEFAULT,
    publicUrl: deps.publicUrl ?? null,
    ownImage: deps.ownImage
  })
  return { router }
}
