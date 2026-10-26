import type { Context } from 'hono'

import { readCappedBody } from '../../../lib/readCappedBody'
import { sniffIconType } from '../domain/icon'
import { pickIconHref, readHtmlHead } from '../domain/iconLinks'
import { safeFetch } from '../domain/ssrf'
import { BOT_USER_AGENT } from '../domain/types'

const ICON_TIMEOUT_MS = 3000
const HIT_CACHE_HEADER = 'public, max-age=604800'
export const CLEAN_MISS_CACHE_HEADER = 'public, max-age=86400'
const ERROR_MISS_CACHE_HEADER = 'public, max-age=600'

// These upstream answers may change soon, so the miss is cached for a short time only.
const isRetryableStatus = (status: number): boolean =>
  status >= 500 || status === 408 || status === 429

type Miss = 'clean' | 'error'
type Icon = { bytes: Uint8Array<ArrayBuffer>; type: string }

const isMiss = (result: Icon | Miss): result is Miss => typeof result === 'string'

const statusMiss = (status: number): Miss => (isRetryableStatus(status) ? 'error' : 'clean')

/**
 * Each hop gets its own controller under the route's one timer. An over-cap read
 * aborts only its own hop, so the HTML fallback can still run after it.
 */
const openHop = (url: string, signal: AbortSignal, accept: string) => {
  const hop = new AbortController()
  const response = safeFetch(url, {
    signal: AbortSignal.any([signal, hop.signal]),
    headers: { 'User-Agent': BOT_USER_AGENT, Accept: accept }
  })
  return { hop, response }
}

const fetchImage = async (url: string, signal: AbortSignal, maxBytes: number) => {
  const { hop, response: pending } = openHop(url, signal, 'image/*')
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    const bytes = await readCappedBody(response, hop, maxBytes)
    const type = bytes && sniffIconType(bytes)
    return type ? { bytes: new Uint8Array(bytes), type } : 'clean'
  } finally {
    hop.abort()
  }
}

// The page head names the icon when `/favicon.ico` has none, as on notion.so.
const fetchHtmlIcon = async (origin: string, signal: AbortSignal, maxBytes: number) => {
  const { hop, response: pending } = openHop(`${origin}/`, signal, 'text/html')
  let href: string | null
  try {
    const response = await pending
    if (!response.ok) return statusMiss(response.status)
    href = pickIconHref(await readHtmlHead(response, hop), response.url || `${origin}/`)
  } finally {
    hop.abort()
  }
  return href ? fetchImage(href, signal, maxBytes) : 'clean'
}

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
      // A throw here means the origin itself failed, so the HTML would fail the same way.
      const favicon = await fetchImage(`${origin}/favicon.ico`, controller.signal, iconMaxBytes)
      if (!isMiss(favicon)) return hit(c, favicon)

      let fallback: Icon | Miss
      try {
        fallback = await fetchHtmlIcon(origin, controller.signal, iconMaxBytes)
      } catch {
        fallback = 'error'
      }
      if (!isMiss(fallback)) return hit(c, fallback)
      return miss(favicon === 'error' || fallback === 'error' ? 'error' : 'clean')
    } catch {
      return miss('error')
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
}

const hit = (c: Context, icon: Icon): Response =>
  c.body(icon.bytes, 200, { 'Content-Type': icon.type, 'Cache-Control': HIT_CACHE_HEADER })
