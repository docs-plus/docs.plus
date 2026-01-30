import { getUserBookmarks } from '@api'
import { useChatStore, useStore } from '@stores'
import { useCallback, useEffect, useRef, useState } from 'react'

type TBookmarkTab = 'in progress' | 'archive' | 'read'

const PAGE_SIZE = 10

interface UseInfiniteBookmarksResult {
  bookmarks: any[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  sentinelRef: (node: HTMLDivElement | null) => void
}

/**
 * Hook for infinite scroll bookmarks.
 * Uses IntersectionObserver to trigger loading more when sentinel is visible.
 */
export const useInfiniteBookmarks = (): UseInfiniteBookmarksResult => {
  const { workspaceId } = useStore((state) => state.settings)
  const { bookmarks, bookmarkActiveTab, setBookmarks, updateBookmarks, loadingBookmarks } =
    useChatStore((state) => state)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Get current tab's bookmarks
  const currentBookmarks = bookmarks.get(bookmarkActiveTab) || []

  // Reset pagination when tab changes
  useEffect(() => {
    setPage(1)
    setHasMore(true)
  }, [bookmarkActiveTab])

  // Fetch bookmarks for a specific page
  const fetchBookmarks = useCallback(
    async (pageNum: number, tab: TBookmarkTab): Promise<any[]> => {
      if (!workspaceId) return []

      try {
        const offset = (pageNum - 1) * PAGE_SIZE
        const archived = tab === 'archive'
        // TODO: Add markedAsRead filter when API supports it

        const { data, error } = await getUserBookmarks({
          workspaceId,
          archived,
          limit: PAGE_SIZE,
          offset
        })

        if (error) throw error
        return data || []
      } catch (error) {
        console.error('Error fetching bookmarks:', error)
        return []
      }
    },
    [workspaceId]
  )

  // Load more bookmarks
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loadingBookmarks) return

    setIsLoadingMore(true)

    try {
      const nextPage = page + 1
      const newBookmarks = await fetchBookmarks(nextPage, bookmarkActiveTab)

      if (newBookmarks.length < PAGE_SIZE) {
        setHasMore(false)
      }

      if (newBookmarks.length > 0) {
        // Append new bookmarks to existing ones
        const existingBookmarks = bookmarks.get(bookmarkActiveTab) || []
        if (updateBookmarks) {
          updateBookmarks(bookmarkActiveTab, [...existingBookmarks, ...newBookmarks])
        } else {
          setBookmarks(bookmarkActiveTab, [...existingBookmarks, ...newBookmarks])
        }
        setPage(nextPage)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    isLoadingMore,
    hasMore,
    loadingBookmarks,
    page,
    fetchBookmarks,
    bookmarkActiveTab,
    bookmarks,
    updateBookmarks,
    setBookmarks
  ])

  // Sentinel ref callback for IntersectionObserver
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Disconnect existing observer
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      if (!node || !hasMore || isLoadingMore) return

      // Create new observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            loadMore()
          }
        },
        {
          root: null,
          rootMargin: '100px',
          threshold: 0.1
        }
      )

      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore]
  )

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return {
    bookmarks: currentBookmarks,
    isLoading: loadingBookmarks,
    isLoadingMore,
    hasMore,
    loadMore,
    sentinelRef
  }
}
