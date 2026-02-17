import type { LinkMetadata } from '@components/settings/types'
import { sanitizeMetadata } from '@components/settings/types'

/**
 * Fetches and sanitizes Open Graph / metadata for a URL via the
 * server-side `POST /api/metadata` endpoint (rate-limited, SSRF-protected).
 *
 * Falls back to `{ title: url }` on any failure — never throws.
 */
export const fetchLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  const formattedUrl = url.startsWith('http') ? url : `https://${url}`

  try {
    const response = await fetch('/api/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: formattedUrl })
    })

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
