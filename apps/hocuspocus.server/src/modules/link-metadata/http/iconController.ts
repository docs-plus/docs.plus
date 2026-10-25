import type { Context } from 'hono'

import { readCappedBody } from '../../../lib/readCappedBody'
import { sniffIconType } from '../domain/icon'
import { safeFetch } from '../domain/ssrf'
import { BOT_USER_AGENT } from '../domain/types'

const ICON_TIMEOUT_MS = 3000
const HIT_CACHE_HEADER = 'public, max-age=604800'
const CLEAN_MISS_CACHE_HEADER = 'public, max-age=86400'
const ERROR_MISS_CACHE_HEADER = 'public, max-age=600'

// These upstream answers may change soon, so the miss is cached for a short time only.
const isRetryableStatus = (status: number): boolean =>
  status >= 500 || status === 408 || status === 429

/**
 * One timer covers every hop, the DNS checks and the body read. A miss is an
 * empty 404, so the `<img>` fires `onerror`. The pino request log already
 * records the path and status, so this adds no log line.
 */
export const createIconController = ({ iconMaxBytes }: { iconMaxBytes: number }) => {
  return async (c: Context): Promise<Response> => {
    const { origin } = c.req.valid('query' as never) as { origin: string }
    const miss = (cacheControl: string) => c.body(null, 404, { 'Cache-Control': cacheControl })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ICON_TIMEOUT_MS)

    try {
      const response = await safeFetch(`${origin}/favicon.ico`, {
        signal: controller.signal,
        headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'image/*' }
      })

      if (isRetryableStatus(response.status)) return miss(ERROR_MISS_CACHE_HEADER)
      if (!response.ok) return miss(CLEAN_MISS_CACHE_HEADER)

      const bytes = await readCappedBody(response, controller, iconMaxBytes)
      const type = bytes ? sniffIconType(bytes) : null
      if (!bytes || !type) return miss(CLEAN_MISS_CACHE_HEADER)

      return c.body(new Uint8Array(bytes), 200, {
        'Content-Type': type,
        'Cache-Control': HIT_CACHE_HEADER
      })
    } catch {
      return miss(ERROR_MISS_CACHE_HEADER)
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
}
