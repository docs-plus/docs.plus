import { normalizeHref } from '@docs.plus/extension-hyperlink'
import type { LinkMetadata } from '@types'
import { apiBaseUrl } from '@utils/apiBaseUrl'
import { sanitizeMetadata } from '@utils/link-helpers'

/**
 * Fetches and sanitizes link metadata via the hocuspocus.server
 * `GET /api/metadata` endpoint (rate-limited, SSRF-protected, cached).
 *
 * Falls back to `{ title: url }` on any failure — never throws.
 */
export const fetchLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  const formattedUrl = normalizeHref(url)

  try {
    const response = await fetch(
      `${apiBaseUrl()}/metadata?url=${encodeURIComponent(formattedUrl)}`,
      { method: 'GET', signal: AbortSignal.timeout(15_000) }
    )

    if (!response.ok) {
      return { title: url }
    }

    const data = await response.json()

    if (!data.success) {
      return { title: url }
    }

    return sanitizeMetadata(data)
  } catch {
    return { title: url }
  }
}
