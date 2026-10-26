import { useEffect, useState } from 'react'

import { fetchMetadata, getCachedMetadata, type MetadataResponse } from './fetchMetadata'

export type LinkMetadataStatus = 'loading' | 'loaded' | 'error'

export interface UseLinkMetadataResult {
  status: LinkMetadataStatus
  data: MetadataResponse | null
}

/**
 * Session cache, then REST, aborting on unmount. Stored mark attrs are
 * never read. `href` is read once on mount; the bottom sheet remounts per
 * link, so no consumer needs a reactive update.
 */
export const useLinkMetadata = (href: string): UseLinkMetadataResult => {
  const [state, setState] = useState<UseLinkMetadataResult>(() => {
    // `getCachedMetadata` returns a tri-state:
    //   `undefined` → no entry (need to fetch)
    //   `null`      → previously cached failure (treat as error, don't refetch)
    //   `MetadataResponse` → cache hit
    const cached = getCachedMetadata(href)
    if (cached) return { status: 'loaded', data: cached }
    if (cached === null) return { status: 'error', data: null }
    return { status: 'loading', data: null }
  })

  useEffect(() => {
    if (state.status !== 'loading') return
    const controller = new AbortController()
    fetchMetadata(href, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return
      setState(data ? { status: 'loaded', data } : { status: 'error', data: null })
    })
    return () => controller.abort()
    // We intentionally only re-run when href changes. A status flip from
    // 'loading' is driven by this effect itself. Refiring on every state
    // change would cancel the in-flight fetch we just started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href])

  return state
}
