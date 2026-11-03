import { useEffect, useState } from 'react'

import { fetchMetadata, getCachedMetadata } from '../hyperlinkPopovers/fetchMetadata'
import { hostnameOf } from '../hyperlinkPopovers/linkMarkUtils'
import type { LinkCard } from '../hyperlinkPopovers/types'

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

const project = (card: LinkCard): MediaUnfurl => ({
  thumbnail: card.image?.url,
  title: card.title,
  hostname: hostnameOf(card.url)
})

/**
 * Debounced metadata unfurl (thumbnail + title) for embed URLs with no static thumbnail.
 * Reuses the shared link-metadata client + its session cache: cache-first so a known URL
 * skips the debounce, no-op when disabled.
 */
export function useMediaUrlUnfurl(url: string, enabled: boolean): UseMediaUrlUnfurlResult {
  // Keyed by URL: a result for an older URL never paints for the new one.
  const [fetched, setFetched] = useState<(UseMediaUrlUnfurlResult & { url: string }) | null>(null)
  const active = enabled && url.trim() !== ''
  const own = active && fetched?.url === url ? fetched : null
  // The session cache is synchronous: undefined = miss, null = no card. Read in render,
  // so the first frame is already the final state or the loader.
  const cached = active && !own ? getCachedMetadata(url) : undefined
  // An entry that expires on a later render flips this, so a loader always has a fetch.
  const needsFetch = active && !own && cached === undefined

  useEffect(() => {
    if (!needsFetch) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void fetchMetadata(url).then((data) => {
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
  }, [url, needsFetch])

  if (!active) return IDLE
  if (own) return own
  if (cached) return { status: 'loaded', data: project(cached) }
  return { status: cached === null ? 'error' : 'loading', data: null }
}
