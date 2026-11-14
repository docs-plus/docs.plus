import type { Context } from 'hono'

import { runPipeline } from '../domain/pipeline'
import { isMiss, relayImage, sniffImageType } from '../domain/relay'
import type { Miss, OwnImage, RelayedImage, StreamedImage } from '../domain/types'
import type { ControllerDeps } from './controller'

export type ImageControllerDeps = ControllerDeps & { ownImage?: OwnImage }

const IMAGE_TIMEOUT_MS = 5000
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const HIT_CACHE_HEADER = 'public, max-age=86400'
const MISS_CACHE_HEADER = 'public, max-age=600'
// A shed relay says nothing about the image, so the browser may ask again at once.
const BUSY_CACHE_HEADER = 'no-store'

/**
 * Takes a page URL and relays the image that page names (#242), so the reader's browser
 * never contacts the linked site. The image is PNG, ICO, GIF, JPEG or WebP, up to 2 MiB,
 * fetched through the SSRF guard. SVG never passes. A miss is an empty 204.
 */
export const createImageController = (deps: ImageControllerDeps) => {
  // A pad link names this REST's own card. Read in process, it skips Traefik and the card bucket.
  const relay = async (
    src: string,
    signal: AbortSignal
  ): Promise<StreamedImage | RelayedImage | Miss | 'busy'> => {
    const own = deps.ownImage?.(src)
    if (!own) return relayImage(src, signal, IMAGE_MAX_BYTES)
    const response = await own
    // A shed or switched-off card points at the Fallback card on the web app host.
    const location = response.status === 302 ? response.headers.get('location') : null
    if (location) return relayImage(location, signal, IMAGE_MAX_BYTES)
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
    const busy = () => c.body(null, 204, { 'Cache-Control': BUSY_CACHE_HEADER })

    const result = await runPipeline({
      requestedUrl: url,
      acceptLanguage: c.req.header('accept-language') ?? undefined,
      cache: deps.cache,
      stages: deps.stages,
      publicUrl: deps.publicUrl,
      padSlugOf: deps.padSlugOf
    })
    if (result.kind === 'success' && result.shed) return busy()
    const src = result.kind === 'success' ? result.payload.image?.url : undefined
    if (!src) return miss()
    // A card built after a special-stage miss or a cut body read may name another image later.
    const retry = result.kind === 'success' && result.retry

    try {
      // One timer bounds the upstream read, a streamed body included. The send to the client has no timer.
      const image = await relay(src, AbortSignal.timeout(IMAGE_TIMEOUT_MS))
      if (image === 'busy') return busy()
      if (isMiss(image)) return miss()
      const headers = {
        'Content-Type': image.type,
        'Cache-Control': retry ? MISS_CACHE_HEADER : HIT_CACHE_HEADER
      }
      if ('bytes' in image) return c.body(image.bytes, 200, headers)
      // Bun sends a stream chunked. A cut stream then ends without its last chunk, so it fails.
      return c.body(image.body, 200, headers)
    } catch {
      return miss()
    }
  }
}
