import { useCallback, useEffect, useRef } from 'react'

type UsePanelFeedSentinelOptions = {
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => void
}

/** Loads the next page when the sentinel under a panel feed scrolls into view. */
export function usePanelFeedSentinel({
  hasMore,
  isLoadingMore,
  loadMore
}: UsePanelFeedSentinelOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null)

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()

      if (!node || !hasMore || isLoadingMore) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            loadMore()
          }
        },
        { root: null, rootMargin: '100px', threshold: 0.1 }
      )

      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore]
  )

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return sentinelRef
}
