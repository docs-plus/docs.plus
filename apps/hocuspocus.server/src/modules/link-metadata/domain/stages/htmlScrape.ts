import { BOT_USER_AGENT, type Scraper, STAGE_TIMEOUT_MS, type StageResult } from '../types'

const USER_AGENT = `Mozilla/5.0 (compatible; ${BOT_USER_AGENT}; +https://docs.plus) facebookexternalhit/1.1`
const MAX_BODY_BYTES = 5 * 1024 * 1024

const META_CHARSET_RE = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i
const META_HTTP_EQUIV_RE =
  /<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]+content\s*=\s*["'][^"']*charset=([\w-]+)/i

const parseCharsetFromHeader = (contentType: string | null): string | null => {
  if (!contentType) return null
  const m = /charset=([\w-]+)/i.exec(contentType)
  return m ? m[1].toLowerCase() : null
}

const parseCharsetFromMeta = (firstKb: string): string | null => {
  const m = META_CHARSET_RE.exec(firstKb) ?? META_HTTP_EQUIV_RE.exec(firstKb)
  return m ? m[1].toLowerCase() : null
}

const isHtml = (contentType: string | null): boolean => {
  if (!contentType) return false
  const lower = contentType.toLowerCase()
  return lower.includes('text/html') || lower.includes('application/xhtml+xml')
}

const filenameFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname
    const last = path.split('/').filter(Boolean).pop()
    return last || new URL(url).hostname
  } catch {
    return url
  }
}

const decodeBody = (bytes: Uint8Array, contentType: string | null): string => {
  let charset = parseCharsetFromHeader(contentType)
  if (!charset) {
    const firstKb = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024))
    charset = parseCharsetFromMeta(firstKb)
  }
  try {
    // Bun's TextDecoder ctor types the encoding as a closed union, but the
    // value here is parsed from arbitrary HTTP / HTML and cannot be narrowed
    // statically. Invalid encodings throw RangeError, which the catch below
    // turns into a utf-8 fallback.
    return new TextDecoder((charset || 'utf-8') as never, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

/**
 * Stream the response body, aborting when the accumulated byte count
 * exceeds MAX_BODY_BYTES. Returns null on overflow or when the body is
 * unavailable. The shared AbortController stops the underlying fetch so
 * we don't continue downloading bytes we'll never read.
 */
const readCappedBody = async (
  response: Response,
  controller: AbortController
): Promise<Uint8Array | null> => {
  if (!response.body) return new Uint8Array(await response.arrayBuffer())

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        controller.abort()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * HTML scrape stage: full HTML fetch + metascraper. Hardened against:
 *   - hostile-to-bot sites (compound UA gets allowlisted by sites that
 *     trust facebookexternalhit while staying transparent)
 *   - non-HTML responses (PDF, image direct links → minimal shape)
 *   - mis-declared / missing charsets (Content-Type → meta → utf-8)
 *   - oversized bodies (streamed cap at MAX_BODY_BYTES; aborts mid-body
 *     instead of trusting Content-Length, which is client-controlled)
 *   - relative OG image / favicon paths after redirects (uses response.url)
 *
 * SSRF NOTE: post-redirect targets are NOT re-validated against the
 * SSRF guard. We rely on the egress-firewalled Docker network — see
 * `../ssrf.ts` for the threat model. If this module ever moves to a
 * host with unrestricted egress, re-validate `response.url` here.
 */
export const runHtmlScrape = async (
  canonicalUrl: string,
  scraper: Scraper,
  acceptLanguage: string | undefined
): Promise<StageResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.html)

  try {
    const response = await fetch(canonicalUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html, application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate, br',
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {})
      }
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type')
    const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return null

    const baseUrl = response.url || canonicalUrl

    if (!isHtml(contentType)) {
      return {
        success: true,
        url: baseUrl,
        requested_url: canonicalUrl,
        title: filenameFromUrl(baseUrl),
        media_type: 'document'
      }
    }

    const buf = await readCappedBody(response, controller)
    if (!buf) return null

    const html = decodeBody(buf, contentType)
    const meta = await scraper.scrape({ html, url: baseUrl })

    if (!meta.title) return null

    return {
      success: true,
      url: baseUrl,
      requested_url: canonicalUrl,
      title: meta.title,
      description: meta.description,
      lang: meta.lang,
      author: meta.author ? { name: meta.author } : undefined,
      publisher: meta.publisher ? { name: meta.publisher } : undefined,
      image: meta.image ? { url: meta.image } : undefined,
      icon: meta.logo,
      published_at: meta.date
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
