import { readPage, type TailLimit } from '../readHead'
import { safeFetch } from '../ssrf'
import {
  type HtmlCard,
  type HtmlMiss,
  LINK_PREVIEW_USER_AGENT,
  type Scraper,
  STAGE_TIMEOUT_MS
} from '../types'
import { primaryLangSubtag } from './cache'

// Bounds the bytes read and parsed; a 5 MiB parse cost about 850 ms and 116 MiB of heap.
// The head scraper's slowest crafted 1 MiB input measured 17 to 18 ms on 2026-11-04 (BENCHMARK.md).
const MAX_PAGE_BYTES = 1024 * 1024
// Job boards put JobPosting JSON-LD in the body: Stripe 49 B after `</head`, Lever 8 KB.
// Reading it cost 300 to 700 ms a page, so only a job-looking URL with no head posting reads it.
const JSON_LD_TAIL: TailLimit = { bytes: 256 * 1024, ms: 1_000 }
const JOB_HOSTS = [
  'lever.co',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.ashbyhq.com',
  'myworkdayjobs.com',
  'apply.workable.com',
  'jobs.smartrecruiters.com',
  'wellfound.com'
]
const JOB_SEGMENT = /^(jobs?|careers?|positions?|posting|vacancy)$/i

/** An applicant-system host, or a path segment such as `/careers/`. */
const looksLikeJobPage = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.toLowerCase()
    if (JOB_HOSTS.some((name) => host === name || host.endsWith(`.${name}`))) return true
    return pathname.split('/').some((segment) => JOB_SEGMENT.test(segment))
  } catch {
    return false
  }
}

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
    return last ? decodeSegment(last) : parsed.hostname
  } catch {
    return url
  }
}

/** `Q3%20Report.pdf` reads as `Q3 Report.pdf`. A bad escape keeps the raw segment. */
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const pickCharset = (head: Uint8Array, contentType: string | null): string | null => {
  const charset = parseCharsetFromHeader(contentType)
  if (charset) return charset
  const firstKb = new TextDecoder('utf-8', { fatal: false }).decode(head.subarray(0, 1024))
  return parseCharsetFromMeta(firstKb)
}

const decodeBody = (bytes: Uint8Array, charset: string | null): string => {
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
 * cannot bounce to an internal host. A miss returns its reason for the log only.
 * `response.url` is the base, so OG image and favicon paths survive a redirect.
 */
export const runHtmlScrape = async (
  canonicalUrl: string,
  scraper: Scraper,
  acceptLanguage: string | undefined
): Promise<HtmlCard | HtmlMiss> => {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, STAGE_TIMEOUT_MS.html)
  const lang = primaryLangSubtag(acceptLanguage)

  try {
    const response = await safeFetch(canonicalUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': LINK_PREVIEW_USER_AGENT,
        Accept: 'text/html, application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate, br',
        ...(lang ? { 'Accept-Language': lang } : {})
      }
    })

    if (!response.ok) {
      if (response.status >= 500) return 'status:5xx'
      return response.status >= 400 ? 'status:4xx' : 'error'
    }

    const contentType = response.headers.get('content-type')
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

    const page = await readPage(response, controller, MAX_PAGE_BYTES)
    const charset = pickCharset(page.head, contentType)
    const meta = await scraper.scrape({ html: decodeBody(page.head, charset), url: baseUrl })
    if (!meta.title) return 'no-title'
    let facts = meta.facts
    let retry = false
    if (!facts && (looksLikeJobPage(canonicalUrl) || looksLikeJobPage(baseUrl))) {
      const tail = await page.readTail(JSON_LD_TAIL)
      facts = scraper.jobFacts(decodeBody(tail.bytes, charset))
      // The posting may sit past where a late or failed read stopped; a later read may find it.
      retry = tail.cut && !facts
    }

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
      published_at: meta.date,
      facts,
      ...(retry ? { retry: true as const } : {})
    }
  } catch {
    return timedOut ? 'timeout' : 'error'
  } finally {
    clearTimeout(timer)
    // Ends every read: an early return, a head-only page, or a tail. The rest of the
    // body is never downloaded. A no-op once the body was fully read.
    controller.abort()
  }
}
