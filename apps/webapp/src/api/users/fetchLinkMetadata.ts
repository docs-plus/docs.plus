import type { LinkMetadata } from '@types'
import { sanitizeMetadata } from '@utils/link-helpers'

const apiBaseUrl = (): string => {
  const base = process.env.NEXT_PUBLIC_RESTAPI_URL
  if (!base) throw new Error('NEXT_PUBLIC_RESTAPI_URL is not configured')
  return base
}

/**
 * Fetches and sanitizes link metadata via the hocuspocus.server
 * `GET /api/metadata` endpoint (rate-limited, SSRF-protected, cached).
 *
 * Falls back to `{ title: url }` on any failure — never throws.
 */
export const fetchLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  const formattedUrl = url.startsWith('http') ? url : `https://${url}`

  try {
    const response = await fetch(
      `${apiBaseUrl()}/metadata?url=${encodeURIComponent(formattedUrl)}`,
      { method: 'GET' }
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
