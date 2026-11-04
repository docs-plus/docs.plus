import type { Context } from 'hono'

import { runPipeline } from '../domain/pipeline'
import { fetchImage, isMiss, sniffImageType } from '../domain/relay'
import type { Miss, RelayedImage } from '../domain/types'
import type { ControllerDeps } from './controller'

const IMAGE_TIMEOUT_MS = 5000
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const HIT_CACHE_HEADER = 'public, max-age=86400'
const MISS_CACHE_HEADER = 'public, max-age=600'

/**
 * Takes a page URL and relays the image that page names (#242), so the reader's browser
 * never contacts the linked site. The image is PNG, ICO, GIF, JPEG or WebP, up to 2 MiB,
 * fetched through the SSRF guard. SVG never passes. A miss is an empty 204.
 */
export const createImageController = (deps: ControllerDeps) => {
  // A pad link names this REST's own card. Read in process, it skips Traefik and the card bucket.
  const relay = async (src: string, signal: AbortSignal): Promise<RelayedImage | Miss> => {
    const own = deps.ownImage?.(src)
    if (!own) return fetchImage(src, signal, IMAGE_MAX_BYTES)
    const response = await own
    // A shed or switched-off card points at the static image on the web app host.
    const location = response.status === 302 ? response.headers.get('location') : null
    if (location) return fetchImage(location, signal, IMAGE_MAX_BYTES)
    if (!response.ok) return 'clean'
    const bytes = new Uint8Array(await response.arrayBuffer())
    const type = sniffImageType(bytes)
    return type ? { bytes, type } : 'clean'
  }

  return async (c: Context): Promise<Response> => {
    const { url } = c.req.valid('query' as never) as { url: string }
    // The pipeline keys on the language, so both answers vary on it.
    c.header('Vary', 'Accept-Language')
    const miss = () => c.body(null, 204, { 'Cache-Control': MISS_CACHE_HEADER })

    const result = await runPipeline({
      requestedUrl: url,
      acceptLanguage: c.req.header('accept-language') ?? undefined,
      cache: deps.cache,
      scraper: deps.scraper,
      stages: deps.stages,
      publicUrl: deps.publicUrl
    })
    const src = result.kind === 'success' ? result.payload.image?.url : undefined
    if (!src) return miss()
    // A card built after a rate limit may name another image once the API answers again.
    const retry = result.kind === 'success' && result.retry

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)
    try {
      const image = await relay(src, controller.signal)
      if (isMiss(image)) return miss()
      return c.body(image.bytes, 200, {
        'Content-Type': image.type,
        'Cache-Control': retry ? MISS_CACHE_HEADER : HIT_CACHE_HEADER
      })
    } catch {
      return miss()
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
}
