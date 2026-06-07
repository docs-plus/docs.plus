import { useEffect, useState } from 'react'

import { fetchMetadata, getCachedMetadata, type MetadataResponse } from './fetchMetadata'

export type LinkMetadataStatus = 'loading' | 'loaded' | 'error'

/**
 * Narrowed metadata shape exposed to UI consumers. Only the fields the
 * sheet renders are surfaced; wire-shape concerns (`success`,
 * `requested_url`, `cached`, `fetched_at`) stay inside `fetchMetadata`.
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
 * Project the wire response (or L1 mark hints) onto `LinkMetadata`. Lets
 * the consuming component depend on a stable subset that won't churn if
 * the backend grows new fields.
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
 * Fetch link metadata with cache-first behavior + abort-on-unmount.
 *
 * Resolution order:
 *   1. Inline L1 (mark attrs supplied via options) — synchronous, no fetch.
 *   2. Session L2 (`getCachedMetadata`) — synchronous, no fetch.
 *   3. Network L3 (`fetchMetadata` → backend → Redis) — async.
 *
 * Both `href` and `options` are read once on mount; later changes are
 * ignored. The bottom-sheet remounts whenever a different link is
 * tapped, which matches the React tree's actual behavior — no consumer
 * needs reactive option updates today.
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
