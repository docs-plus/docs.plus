import type { StageResult } from '../types'

const googleFaviconUrl = (origin: string): string =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=64`

/**
 * Last-resort stage. Always returns a usable shape so the client always
 * has *something* to render. Negative cache TTL applies to this result.
 */
export const runFallback = (
  canonicalUrl: string,
  requestedUrl: string = canonicalUrl
): NonNullable<StageResult> => {
  let parsed: URL | null = null
  try {
    parsed = new URL(canonicalUrl)
  } catch {
    parsed = null
  }

  return {
    success: true,
    url: canonicalUrl,
    requested_url: requestedUrl,
    title: parsed?.hostname || canonicalUrl,
    favicon: parsed ? googleFaviconUrl(parsed.origin) : undefined
  }
}
