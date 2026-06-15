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
  const [state, setState] = useState<UseMediaUrlUnfurlResult>({ status: 'idle', data: null })

  useEffect(() => {
    if (!enabled || !url.trim()) {
      setState({ status: 'idle', data: null })
      return
    }

    // L2 session cache is synchronous: undefined = miss, null = cached failure.
    const cached = getCachedMetadata(url)
    if (cached) {
      setState({ status: 'loaded', data: project(cached) })
      return
    }
    if (cached === null) {
      setState({ status: 'error', data: null })
      return
    }

    setState({ status: 'loading', data: null })
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void fetchMetadata(url, { signal: controller.signal }).then((data) => {
        if (controller.signal.aborted) return
        setState(data ? { status: 'loaded', data: project(data) } : { status: 'error', data: null })
      })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [url, enabled])

  return state
}
