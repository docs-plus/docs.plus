import { useEffect, useState } from 'react'

import { fetchMetadata, getCachedMetadata, type MetadataResponse } from './fetchMetadata'

export type LinkMetadataStatus = 'loading' | 'loaded' | 'error'

/**
 * Only what the sheet renders; wire-shape concerns (`success`, `cached`,
 * `requested_url`, `fetched_at`) stay inside `fetchMetadata`.
 */
export interface LinkMetadata {
  title: string
  description?: string
  icon?: string
  favicon?: string
  publisher?: { logo?: string }
  image?: { url: string; alt?: string }
  oembed?: { thumbnail?: string }
}

export interface UseLinkMetadataResult {
  status: LinkMetadataStatus
  data: LinkMetadata | null
}

/**
 * Keeps consumers on a stable subset that won't churn when the backend grows
 * new fields.
 */
const toLinkMetadata = (data: MetadataResponse): LinkMetadata => ({
  title: data.title,
  description: data.description,
  icon: data.icon,
  favicon: data.favicon,
  publisher: data.publisher ? { logo: data.publisher.logo } : undefined,
  image: data.image,
  oembed: data.oembed ? { thumbnail: data.oembed.thumbnail } : undefined
})

/** Build a `LinkMetadata` from L1 mark attrs (title + optional image). */
const fromMarkAttrs = (title: string, image: string | undefined): LinkMetadata => ({
  title,
  image: image ? { url: image } : undefined
})

export interface UseLinkMetadataOptions {
  /** L1 cache hint: title persisted on the Tiptap mark. */
  initialTitle?: string
  /** L1 cache hint: image persisted on the Tiptap mark. */
  initialImage?: string
}

/**
 * Cache-first: L1 mark attrs → L2 session cache → L3 network, aborting on
 * unmount. `href` and `options` are read once on mount; the bottom sheet
 * remounts per link, so no consumer needs reactive option updates.
 */
export const useLinkMetadata = (
  href: string,
  options?: UseLinkMetadataOptions
): UseLinkMetadataResult => {
  const initialTitle = options?.initialTitle
  const initialImage = options?.initialImage

  const [state, setState] = useState<UseLinkMetadataResult>(() => {
    if (initialTitle) {
      return { status: 'loaded', data: fromMarkAttrs(initialTitle, initialImage) }
    }
    // `getCachedMetadata` returns a tri-state:
    //   `undefined` → no entry (need to fetch)
    //   `null`      → previously cached failure (treat as error, don't refetch)
    //   `MetadataResponse` → cache hit
    const cached = getCachedMetadata(href)
    if (cached) return { status: 'loaded', data: toLinkMetadata(cached) }
    if (cached === null) return { status: 'error', data: null }
    return { status: 'loading', data: null }
  })

  useEffect(() => {
    if (state.status !== 'loading') return
    const controller = new AbortController()
    fetchMetadata(href, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return
      setState(
        data ? { status: 'loaded', data: toLinkMetadata(data) } : { status: 'error', data: null }
      )
    })
    return () => controller.abort()
    // We intentionally only re-run when href changes. A status flip from
    // 'loading' is driven by this effect itself; refiring on every state
    // change would cancel the in-flight fetch we just started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href])

  return state
}
