import { decodeHTML } from 'entities'
import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { RedisClient } from '../../types/redis.types'
import { ICON_MAX_BYTES_DEFAULT } from './domain/icon'
import { PAD_GENERATION_TTL_SECONDS, padGenerationKey } from './domain/stages/cache'
import { runSpecialHandler } from './domain/stages/handlers'
import { runHtmlScrape } from './domain/stages/htmlScrape'
import { runOembed } from './domain/stages/oembed'
import type { ApiKeys, OwnImage } from './domain/types'
import { createRouter } from './http/router'
import { createHeadScraper } from './infra/headScraper'
import { createArchiveCache, createRedisCache } from './infra/redisCache'

export interface InitDeps {
  redis: RedisClient | null
  logger: Logger
  iconMaxBytes?: number
  publicUrl?: string | null
  ownImage?: OwnImage
  apiKeys?: ApiKeys
  /** The slug key of the docs.plus pad a URL opens, or null. Without it, no card is a pad card. */
  padSlugOf?: (url: string) => string | null
}

export interface InitResult {
  router: Hono
  /**
   * Hides every cached card of one pad, by the slug key `padSlugOf` gives. Call it when the
   * pad's access narrows. It never rejects: a failure logs the key, and the cards expire by TTL.
   */
  forgetPad: (slugKey: string) => Promise<void>
}

export const init = (deps: InitDeps): InitResult => {
  const cache = createRedisCache(deps.redis)
  const scraper = createHeadScraper()

  const apiKeys: ApiKeys = deps.apiKeys ?? { githubToken: null, stackExchangeKey: null }
  const stages = {
    oembed: runOembed,
    special: (canonicalUrl: string) => runSpecialHandler(canonicalUrl, apiKeys, decodeHTML),
    html: runHtmlScrape
  }

  const router = createRouter({
    cache,
    scraper,
    stages,
    logger: deps.logger,
    iconMaxBytes: deps.iconMaxBytes ?? ICON_MAX_BYTES_DEFAULT,
    archiveCache: createArchiveCache(deps.redis),
    publicUrl: deps.publicUrl ?? null,
    ownImage: deps.ownImage,
    padSlugOf: deps.padSlugOf
  })

  const forgetPad = async (slugKey: string): Promise<void> => {
    if (!slugKey) return
    try {
      await cache.newGeneration(padGenerationKey(slugKey), PAD_GENERATION_TTL_SECONDS)
    } catch (err) {
      deps.logger.warn({ err, slug: slugKey }, 'Pad link cards not forgotten')
    }
  }
  return { router, forgetPad }
}
