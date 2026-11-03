import type { Context } from 'hono'

import { fetchSiteIcon } from '../domain/icon'
import { isMiss } from '../domain/relay'
import type { Miss, RelayedImage } from '../domain/types'

const ICON_TIMEOUT_MS = 3000
const HIT_CACHE_HEADER = 'public, max-age=604800'
export const CLEAN_MISS_CACHE_HEADER = 'public, max-age=86400'
const ERROR_MISS_CACHE_HEADER = 'public, max-age=600'

/**
 * One timer covers every hop, the DNS checks and both body reads. A miss is an
 * empty 204, so the `<img>` fires `onerror` and Chrome logs no red 404. The pino
 * request log already records the path and status, so this adds no log line.
 */
export const createIconController = ({ iconMaxBytes }: { iconMaxBytes: number }) => {
  return async (c: Context): Promise<Response> => {
    const { origin } = c.req.valid('query' as never) as { origin: string }
    const miss = (kind: Miss) =>
      c.body(null, 204, {
        'Cache-Control': kind === 'error' ? ERROR_MISS_CACHE_HEADER : CLEAN_MISS_CACHE_HEADER
      })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ICON_TIMEOUT_MS)

    try {
      const icon = await fetchSiteIcon(origin, controller.signal, iconMaxBytes)
      return isMiss(icon) ? miss(icon) : hit(c, icon)
    } catch {
      return miss('error')
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
}

const hit = (c: Context, icon: RelayedImage): Response =>
  c.body(icon.bytes, 200, { 'Content-Type': icon.type, 'Cache-Control': HIT_CACHE_HEADER })
