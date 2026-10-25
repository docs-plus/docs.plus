import type { StageResult } from '../types'

/**
 * Last-resort stage. Always returns a usable shape so the client always
 * has *something* to render. Negative cache TTL applies to this result.
 */
export const runFallback = (
  canonicalUrl: string,
  requestedUrl: string = canonicalUrl,
  publicUrl: string | null = null
): NonNullable<StageResult> => {
  let parsed: URL | null
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
    // Literal path: LINK_ICON_PATH lives in http/router.ts, which imports hono (rule 4) and leads back here (import cycle).
    favicon:
      parsed && publicUrl
        ? `${publicUrl}/api/metadata/icon?origin=${encodeURIComponent(parsed.origin)}`
        : undefined
  }
}
