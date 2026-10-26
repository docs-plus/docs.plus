import { LINK_ICON_PATH } from '../icon'
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
    favicon:
      parsed && publicUrl
        ? `${publicUrl}${LINK_ICON_PATH}?origin=${encodeURIComponent(parsed.origin)}`
        : undefined
  }
}
