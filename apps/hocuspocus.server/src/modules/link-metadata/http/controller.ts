import type { Context } from 'hono'
import type { Logger } from 'pino'

import { type PipelineStages, runPipeline, type StageEvent } from '../domain/pipeline'
import type { Cache, ErrorResponse, MetadataResponse, Scraper } from '../domain/types'

export interface ControllerDeps {
  cache: Cache
  scraper: Scraper
  stages: PipelineStages
  logger: Logger
  publicUrl: string | null
}

const POSITIVE_CACHE_HEADER = 'public, max-age=3600, stale-while-revalidate=86400'
const NEGATIVE_CACHE_HEADER = 'public, max-age=600'

export const createController = (deps: ControllerDeps) => {
  return async (c: Context): Promise<Response> => {
    const { url: requestedUrl } = c.req.valid('query' as never) as { url: string }
    const acceptLanguage = c.req.header('accept-language') ?? undefined
    const start = Date.now()

    const stageEvents: StageEvent[] = []
    const result = await runPipeline({
      requestedUrl,
      acceptLanguage,
      cache: deps.cache,
      scraper: deps.scraper,
      stages: deps.stages,
      publicUrl: deps.publicUrl,
      onStage: (e) => stageEvents.push(e)
    })

    if (result.kind === 'error') {
      const body: ErrorResponse = {
        success: false,
        message: result.message,
        code: result.code
      }
      deps.logger.warn(
        {
          host: safeHost(requestedUrl),
          code: result.code,
          duration_ms: Date.now() - start
        },
        'metadata request rejected'
      )
      return c.json(body, 400)
    }

    const response: MetadataResponse = {
      ...result.payload,
      cached: result.fromCache,
      fetched_at: new Date().toISOString()
    }

    const pipelineStage =
      stageEvents.find((e) => e.hit)?.stage ?? (result.fromCache ? 'cache' : 'fallback')

    deps.logger.info(
      {
        host: safeHost(response.url),
        cache_hit: result.fromCache,
        pipeline_stage: pipelineStage,
        duration_ms: Date.now() - start,
        stages: stageEvents
      },
      'metadata request completed'
    )

    c.header('Cache-Control', result.fallback ? NEGATIVE_CACHE_HEADER : POSITIVE_CACHE_HEADER)
    c.header('Vary', 'Accept-Language')
    return c.json(response, 200)
  }
}

// Log the host only. Users paste OAuth callbacks, magic-login links and signed share
// URLs, whose path or query can carry secrets (OWASP A09).
const safeHost = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
