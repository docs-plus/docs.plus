/**
 * Layer 2 of the tolerance bench: the link-metadata router alone, built from the module's own
 * parts with injected stages, so option A/Bs need no product edit. Not product code.
 * Run under the shim: `bun --preload ./shim.ts layer2.ts` with BENCH_VARIANT=module|baseline|coalesce.
 * `module` calls the real init(). `baseline` mirrors init() line for line and adds a parse timer.
 * Both keep the link buckets of the REST limiter. No request log and no metrics: compare behaviour.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

import { decodeHTML } from 'entities'
import { Hono } from 'hono'

import { config } from '../../src/config/env'
import { logger } from '../../src/lib/logger'
import { getRedisClient } from '../../src/lib/redis'
import { padSlugOfUrl } from '../../src/lib/slug'
import { rateLimiter } from '../../src/middleware'
import * as linkMetadata from '../../src/modules/link-metadata'
import {
  LINK_ARCHIVE_PATH,
  LINK_ICON_PATH,
  LINK_IMAGE_PATH,
  LINK_METADATA_MOUNT_PATH
} from '../../src/modules/link-metadata'
import type { PipelineStages } from '../../src/modules/link-metadata/domain/pipeline'
import { primaryLangSubtag } from '../../src/modules/link-metadata/domain/stages/cache'
import { runSpecialHandler } from '../../src/modules/link-metadata/domain/stages/handlers'
import { runHtmlScrape } from '../../src/modules/link-metadata/domain/stages/htmlScrape'
import { runOembed } from '../../src/modules/link-metadata/domain/stages/oembed'
import type { Scraper } from '../../src/modules/link-metadata/domain/types'
import { createRouter } from '../../src/modules/link-metadata/http/router'
import { createHeadScraper } from '../../src/modules/link-metadata/infra/headScraper'
import {
  createArchiveCache,
  createRedisCache
} from '../../src/modules/link-metadata/infra/redisCache'

const VARIANT = process.env.BENCH_VARIANT ?? 'baseline'
const redis = getRedisClient()

// Same deps as src/index.ts. ownImage there comes from the social-card module and answers
// null for every URL while PUBLIC_RESTAPI_URL is unset, as it is in the bench.
const padSlugOf = (url: string) => padSlugOfUrl(url, config.app.hosts)
const ownImage = () => null

// Parse time per request, so a run can price parse against request time (the Rust trigger).
const requestTiming = new AsyncLocalStorage<{ parseMs: number }>()
const baseScraper = createHeadScraper()
const scraper: Scraper = {
  scrape: async (input) => {
    const start = performance.now()
    try {
      return await baseScraper.scrape(input)
    } finally {
      const store = requestTiming.getStore()
      if (store) store.parseMs += performance.now() - start
    }
  },
  jobFacts: (body) => baseScraper.jobFacts(body)
}

// Same wiring as module.ts init(): the baseline variant must behave as layer 1 does.
const apiKeys = config.linkMetadata.apiKeys
const baselineStages = (): PipelineStages => ({
  oembed: runOembed,
  special: (url) => runSpecialHandler(url, apiKeys, decodeHTML),
  html: (url, lang) => runHtmlScrape(url, scraper, lang)
})

let coalesced = 0
/** Example option: one html fetch per canonical URL and language while one is in flight. */
const withCoalescing = (stages: PipelineStages): PipelineStages => {
  const inflight = new Map<string, ReturnType<PipelineStages['html']>>()
  return {
    ...stages,
    html: (url, lang) => {
      const key = `${url}|${primaryLangSubtag(lang) ?? '_'}`
      const running = inflight.get(key)
      if (running) {
        coalesced += 1
        return running
      }
      const next = stages.html(url, lang).finally(() => inflight.delete(key))
      inflight.set(key, next)
      return next
    }
  }
}

const mirrorRouter = (stages: PipelineStages) =>
  createRouter({
    cache: createRedisCache(redis),
    stages,
    logger: logger.child({ module: 'link-metadata' }),
    iconMaxBytes: config.linkMetadata.iconMaxBytes,
    archiveCache: createArchiveCache(redis),
    publicUrl: config.app.publicUrl,
    ownImage,
    padSlugOf
  })

const ROUTERS: Record<string, () => Hono> = {
  module: () =>
    linkMetadata.init({
      redis,
      logger: logger.child({ module: 'link-metadata' }),
      iconMaxBytes: config.linkMetadata.iconMaxBytes,
      publicUrl: config.app.publicUrl,
      ownImage,
      apiKeys,
      padSlugOf
    }).router,
  baseline: () => mirrorRouter(baselineStages()),
  coalesce: () => mirrorRouter(withCoalescing(baselineStages()))
}
if (!ROUTERS[VARIANT]) throw new Error(`unknown BENCH_VARIANT ${VARIANT}`)
const router = ROUTERS[VARIANT]()

let samples: { totalMs: number; parseMs: number }[] = []
const quantile = (sorted: number[], q: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

// The two link buckets of src/middleware/index.ts, with the same points and key prefixes.
const linkIconLimiter = rateLimiter({
  points: config.security.rateLimitMax * 10,
  duration: 15 * 60,
  keyPrefix: 'metadata-icon'
})
const linkMetadataLimiter = rateLimiter({
  points: config.security.rateLimitMax * 10,
  duration: 15 * 60,
  keyPrefix: 'link-metadata'
})

const app = new Hono()
app.get('/health/live', (c) => c.json({ status: 'healthy', layer: 2, variant: VARIANT }))
app.get('/__layer2/stats', (c) => {
  const parsed = samples.filter((s) => s.parseMs > 0)
  const share = parsed.map((s) => s.parseMs / s.totalMs).sort((a, b) => a - b)
  const parse = parsed.map((s) => s.parseMs).sort((a, b) => a - b)
  const body = {
    variant: VARIANT,
    requests: samples.length,
    parsedRequests: parsed.length,
    coalesced,
    parseMs: { p50: quantile(parse, 0.5), p95: quantile(parse, 0.95), max: parse.at(-1) ?? 0 },
    parseShare: { p50: quantile(share, 0.5), p95: quantile(share, 0.95), max: share.at(-1) ?? 0 }
  }
  if (c.req.query('reset') !== undefined) {
    samples = []
    coalesced = 0
  }
  return c.json(body)
})
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (path === LINK_ICON_PATH) return linkIconLimiter(c, next)
  if (path === LINK_METADATA_MOUNT_PATH || path === LINK_IMAGE_PATH || path === LINK_ARCHIVE_PATH)
    return linkMetadataLimiter(c, next)
  return next()
})
app.use(`${LINK_METADATA_MOUNT_PATH}/*`, async (c, next) => {
  const store = { parseMs: 0 }
  const start = performance.now()
  await requestTiming.run(store, next)
  samples.push({ totalMs: performance.now() - start, parseMs: store.parseMs })
})
app.route(LINK_METADATA_MOUNT_PATH, router)

Bun.serve({ fetch: app.fetch, port: config.app.port, hostname: '127.0.0.1', idleTimeout: 60 })
logger.info({ msg: 'layer2 bench server started', port: config.app.port, variant: VARIANT })
