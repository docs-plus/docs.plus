import { useEffect, useState } from 'react'

import { fetchMetadata, getCachedMetadata, type MetadataResponse } from './fetchMetadata'

export type LinkMetadataStatus = 'loading' | 'loaded' | 'error'

export interface UseLinkMetadataResult {
  status: LinkMetadataStatus
  data: MetadataResponse | null
}

/**
 * Session cache, then REST. On unmount the late result is dropped; the shared request
 * still fills the cache. Stored mark attrs are never read. `href` is read once on mount;
 * the bottom sheet remounts per link, so no consumer needs a reactive update.
 */
export const useLinkMetadata = (href: string): UseLinkMetadataResult => {
  const [state, setState] = useState<UseLinkMetadataResult>(() => {
    const cached = getCachedMetadata(href)
    if (cached) return { status: 'loaded', data: cached }
    if (cached === null) return { status: 'error', data: null }
    return { status: 'loading', data: null }
  })

  useEffect(() => {
    if (state.status !== 'loading') return
    const controller = new AbortController()
    fetchMetadata(href).then((data) => {
      if (controller.signal.aborted) return
      setState(data ? { status: 'loaded', data } : { status: 'error', data: null })
    })
    return () => controller.abort()
    // Re-run only when href changes. The status flip comes from this effect itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href])

  return state
}
