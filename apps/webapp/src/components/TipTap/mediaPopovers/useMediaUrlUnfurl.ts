import { useEffect, useState } from 'react'

import {
  fetchMetadata,
  getCachedMetadata,
  type MetadataResponse
} from '../hyperlinkPopovers/fetchMetadata'

export type MediaUnfurlStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface MediaUnfurl {
  thumbnail?: string
  title: string
  hostname: string
}

export interface UseMediaUrlUnfurlResult {
  status: MediaUnfurlStatus
  data: MediaUnfurl | null
}

const DEBOUNCE_MS = 400
const IDLE: UseMediaUrlUnfurlResult = { status: 'idle', data: null }

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const project = (data: MetadataResponse): MediaUnfurl => ({
  thumbnail: data.image?.url ?? data.oembed?.thumbnail,
  title: data.title,
  hostname: hostnameOf(data.url)
})

/**
 * Debounced metadata unfurl (thumbnail + title) for embed URLs with no static
 * thumbnail. Reuses the shared link-metadata client + its session cache:
 * cache-first so a known URL skips the debounce, no-ops when disabled.
 */
export function useMediaUrlUnfurl(url: string, enabled: boolean): UseMediaUrlUnfurlResult {
  // Keyed by URL: a result for an older URL never paints for the new one.
  const [fetched, setFetched] = useState<(UseMediaUrlUnfurlResult & { url: string }) | null>(null)
  const active = enabled && url.trim() !== ''

  useEffect(() => {
    // L2 session cache is synchronous: undefined = miss, null = cached failure.
    if (!active || getCachedMetadata(url) !== undefined) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void fetchMetadata(url, { signal: controller.signal }).then((data) => {
        if (controller.signal.aborted) return
        setFetched(
          data
            ? { url, status: 'loaded', data: project(data) }
            : { url, status: 'error', data: null }
        )
      })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [url, active])

  if (!active) return IDLE
  if (fetched?.url === url) return fetched
  // Read in render, so the first frame is already the final state or the loader.
  const cached = getCachedMetadata(url)
  if (cached) return { status: 'loaded', data: project(cached) }
  return { status: cached === null ? 'error' : 'loading', data: null }
}
