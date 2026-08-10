import { readCappedBody } from '../../../../lib/readCappedBody'
import { safeFetch } from '../ssrf'
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
    const parsed = new URL(url)
    const last = parsed.pathname.split('/').filter(Boolean).pop()
    return last || parsed.hostname
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
 * `safeFetch` re-runs the SSRF host check on every redirect hop, so a public URL
 * cannot bounce to an internal host. The compound UA is deliberate: sites that
 * allowlist facebookexternalhit serve this bot while it stays transparent.
 * `response.url` is the base, so OG image and favicon paths survive a redirect.
 */
export const runHtmlScrape = async (
  canonicalUrl: string,
  scraper: Scraper,
  acceptLanguage: string | undefined
): Promise<StageResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.html)

  try {
    const response = await safeFetch(canonicalUrl, {
      signal: controller.signal,
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

    const buf = await readCappedBody(response, controller, MAX_BODY_BYTES)
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
    // Release the socket on early returns (non-ok / non-HTML / oversized) that
    // never drained the body. A no-op once the body was fully read.
    controller.abort()
  }
}
