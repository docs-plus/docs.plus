import { canonicalize } from './canonicalize'
import { isSafeUrl } from './ssrf'
import { readCache, writeCache } from './stages/cache'
import { runFallback } from './stages/fallback'
import type { Cache, ErrorResponse, Scraper, StageResult } from './types'

export interface PipelineStages {
  oembed: (canonicalUrl: string) => Promise<StageResult>
  special: (canonicalUrl: string) => Promise<StageResult>
  html: (
    canonicalUrl: string,
    scraper: Scraper,
    acceptLanguage: string | undefined
  ) => Promise<StageResult>
}

export interface PipelineInput {
  requestedUrl: string
  acceptLanguage: string | undefined
  cache: Cache
  scraper: Scraper
  stages: PipelineStages
  /** Optional logger hook the controller wires up; pipeline stays framework-free. */
  onStage?: (event: { stage: string; hit: boolean; durationMs: number }) => void
}

export type PipelineResult =
  | { kind: 'success'; payload: NonNullable<StageResult>; fromCache: boolean }
  | { kind: 'error'; status: 400; message: string; code: ErrorResponse['code'] }

const orderedStageNames = ['oembed', 'special', 'html'] as const

export const runPipeline = async (input: PipelineInput): Promise<PipelineResult> => {
  const { requestedUrl, acceptLanguage, cache, scraper, stages, onStage } = input

  if (!isSafeUrl(requestedUrl)) {
    let parsed: URL | null = null
    try {
      parsed = new URL(requestedUrl)
    } catch {
      // fallthrough
    }
    return parsed
      ? { kind: 'error', status: 400, message: 'URL is not allowed', code: 'BLOCKED_URL' }
      : { kind: 'error', status: 400, message: 'URL is not valid', code: 'INVALID_URL' }
  }

  const canonical = canonicalize(requestedUrl)

  const cached = await readCache(cache, canonical, acceptLanguage)
  if (cached) {
    return {
      kind: 'success',
      payload: { ...cached, requested_url: requestedUrl },
      fromCache: true
    }
  }

  for (const name of orderedStageNames) {
    const start = Date.now()
    let result: StageResult = null
    try {
      result =
        name === 'html'
          ? await stages.html(canonical, scraper, acceptLanguage)
          : await stages[name](canonical)
    } catch {
      // A misbehaving stage must not block the fallback. Treat throws as misses.
      result = null
    }
    onStage?.({ stage: name, hit: result !== null, durationMs: Date.now() - start })

    if (result) {
      const withRequested = { ...result, requested_url: requestedUrl }
      await writeCache(cache, canonical, acceptLanguage, withRequested, 'positive')
      return { kind: 'success', payload: withRequested, fromCache: false }
    }
  }

  const fallback = runFallback(canonical, requestedUrl)
  await writeCache(cache, canonical, acceptLanguage, fallback, 'negative')
  onStage?.({ stage: 'fallback', hit: true, durationMs: 0 })
  return { kind: 'success', payload: fallback, fromCache: false }
}
