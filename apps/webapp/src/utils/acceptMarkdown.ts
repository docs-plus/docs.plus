import { DocumentFetchError } from '@utils/fetchDocument'

const MARKDOWN_FETCH_TIMEOUT_MS = 10000
const Q_VALUE_RE = /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/

export interface MarkdownFetchResult {
  status: number
  body: string
  retryAfter?: string
}

const splitOutsideQuotes = (input: string, delimiter: string): string[] => {
  const parts: string[] = []
  let start = 0
  let inQuotes = false
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inQuotes && ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && ch === delimiter) {
      parts.push(input.slice(start, i))
      start = i + 1
    }
  }

  parts.push(input.slice(start))
  return parts
}

/**
 * Strict RFC 9110 `Accept` check for Markdown negotiation:
 * ignores wildcards (`*\/*`, `text/*`), rejects invalid or zero `q` values,
 * and breaks ties in favor of HTML.
 */
export function prefersMarkdownAccept(acceptHeader: string | string[] | undefined): boolean {
  const raw = Array.isArray(acceptHeader) ? acceptHeader.join(',') : acceptHeader
  if (!raw || !raw.trim()) return false

  let qMarkdown = 0
  let qHtml = 0
  let markdownRejected = false

  for (const range of splitOutsideQuotes(raw, ',')) {
    const segments = splitOutsideQuotes(range, ';')
    const mediaType = (segments[0] ?? '').trim().toLowerCase()
    if (mediaType !== 'text/markdown' && mediaType !== 'text/html') continue

    let q = 1
    let seenQ = false
    let valid = true

    for (const rawParam of segments.slice(1)) {
      const param = rawParam.trim()
      if (!param) continue
      if (/^q=/i.test(param)) {
        if (seenQ) {
          valid = false
          break
        }
        seenQ = true
        const rawQ = param.slice(2)
        if (!Q_VALUE_RE.test(rawQ)) {
          valid = false
          break
        }
        q = Number(rawQ)
      }
    }

    if (!valid) continue

    if (mediaType === 'text/markdown') {
      if (q === 0) markdownRejected = true
      else qMarkdown = Math.max(qMarkdown, q)
    } else {
      qHtml = Math.max(qHtml, q)
    }
  }

  return !markdownRejected && qMarkdown > 0 && qMarkdown > qHtml
}

export async function fetchDocumentMarkdown(
  slug: string,
  forwardHeaders?: { realIp?: string; forwardedFor?: string }
): Promise<MarkdownFetchResult> {
  const rawBase = process.env.SERVER_RESTAPI_URL || process.env.NEXT_PUBLIC_RESTAPI_URL
  const apiBaseUrl = rawBase?.replace(/\/+$/, '')

  if (!apiBaseUrl) {
    throw new DocumentFetchError('API URL not configured')
  }

  const headers: Record<string, string> = { Accept: 'text/markdown' }
  if (forwardHeaders?.realIp) headers['x-real-ip'] = forwardHeaders.realIp
  if (forwardHeaders?.forwardedFor) headers['x-forwarded-for'] = forwardHeaders.forwardedFor

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MARKDOWN_FETCH_TIMEOUT_MS)

  try {
    const url = `${apiBaseUrl}/documents/${encodeURIComponent(slug)}/markdown`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })

    if (response.status === 200) {
      return { status: 200, body: await response.text() }
    }

    if (response.status === 404 || response.status === 413) {
      await response.body?.cancel?.().catch(() => {})
      return { status: response.status, body: '' }
    }

    if (response.status === 429) {
      await response.body?.cancel?.().catch(() => {})
      return {
        status: 429,
        body: '',
        retryAfter: response.headers.get('retry-after') ?? undefined
      }
    }

    await response.body?.cancel?.().catch(() => {})
    throw new DocumentFetchError(`Failed to fetch document markdown: ${response.status}`, {
      status: response.status
    })
  } catch (error) {
    if (error instanceof DocumentFetchError) throw error
    throw new DocumentFetchError('Network error while fetching document markdown', {
      originalError: error instanceof Error ? error : new Error(String(error))
    })
  } finally {
    clearTimeout(timeoutId)
  }
}
