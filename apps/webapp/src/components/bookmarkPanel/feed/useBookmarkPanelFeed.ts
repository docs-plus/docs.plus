import { getBookmarkStats, getUserBookmarks } from '@api'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { type TBookmarkTab, type TBookmarkWithMessage } from '@types'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BOOKMARK_PAGE_SIZE, bookmarkTabFetchParams } from '../utils/bookmarkTabQuery'

type UseBookmarkPanelFeedResult = {
  bookmarks: TBookmarkWithMessage[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  sentinelRef: (node: HTMLDivElement | null) => void
}

export function useBookmarkPanelFeed(): UseBookmarkPanelFeedResult {
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const user = useAuthStore((state) => state.profile)
  const bookmarks = useChatStore((state) => state.bookmarks)
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const loadingBookmarks = useChatStore((state) => state.loadingBookmarks)
  const {
    setBookmarkSummary,
    setBookmarks,
    clearBookmarks,
    setLoadingBookmarks,
    setBookmarkTab,
    setBookmarkPage,
    updateBookmarks
  } = useChatStore((state) => state)
  const { request: statsRequest } = useApi(getBookmarkStats, null, false)
  const { request: listRequest } = useApi(getUserBookmarks, null, false)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const currentBookmarks = bookmarks.get(bookmarkActiveTab) || []

  useEffect(() => {
    if (!user) return
    setLoadingBookmarks(true)
    clearBookmarks()

    const loadTab = (tab: TBookmarkTab) => {
      const { archived, markedAsRead } = bookmarkTabFetchParams(tab)
      return listRequest({
        workspaceId,
        archived,
        markedAsRead,
        limit: BOOKMARK_PAGE_SIZE,
        offset: 0
      })
    }

    const refreshFeed = async () => {
      try {
        const { data: statsData, error: statsError } = await statsRequest({ workspaceId })
        if (statsError) throw statsError

        const [inProgressResult, archivedResult, readResult] = await Promise.all([
          loadTab('in progress'),
          loadTab('archive'),
          loadTab('read')
        ])

        for (const result of [inProgressResult, archivedResult, readResult]) {
          if (result.error) throw result.error
        }

        if (statsData) {
          const summaryData = Array.isArray(statsData) ? statsData[0] : statsData
          setBookmarkSummary(summaryData)
          setBookmarkTab('in progress', summaryData.unread || 0)
          setBookmarkTab('archive', summaryData.archived || 0)
          setBookmarkTab('read', summaryData.read || 0)
        }

        setBookmarks('in progress', inProgressResult.data || [])
        setBookmarks('archive', archivedResult.data || [])
        setBookmarks('read', readResult.data || [])
        setBookmarkPage(1)
      } catch (error) {
        console.error('Error fetching bookmark feed:', error)
      } finally {
        setLoadingBookmarks(false)
      }
    }

    refreshFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId])

  useEffect(() => {
    setPage(1)
  }, [bookmarkActiveTab])

  useEffect(() => {
    if (loadingBookmarks) return
    const count = (bookmarks.get(bookmarkActiveTab) || []).length
    setHasMore(count >= BOOKMARK_PAGE_SIZE)
  }, [bookmarkActiveTab, bookmarks, loadingBookmarks])

  const fetchPage = useCallback(
    async (pageNum: number, tab: TBookmarkTab): Promise<TBookmarkWithMessage[]> => {
      if (!workspaceId) return []

      try {
        const offset = (pageNum - 1) * BOOKMARK_PAGE_SIZE
        const { archived, markedAsRead } = bookmarkTabFetchParams(tab)
        const { data, error } = await getUserBookmarks({
          workspaceId,
          archived,
          markedAsRead,
          limit: BOOKMARK_PAGE_SIZE,
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

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loadingBookmarks) return

    setIsLoadingMore(true)

    try {
      const nextPage = page + 1
      const newBookmarks = await fetchPage(nextPage, bookmarkActiveTab)

      if (newBookmarks.length < BOOKMARK_PAGE_SIZE) {
        setHasMore(false)
      }

      if (newBookmarks.length > 0) {
        const existingBookmarks = bookmarks.get(bookmarkActiveTab) || []
        updateBookmarks(bookmarkActiveTab, [...existingBookmarks, ...newBookmarks])
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
    fetchPage,
    bookmarkActiveTab,
    bookmarks,
    updateBookmarks
  ])

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

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

  return {
    bookmarks: currentBookmarks,
    isLoading: loadingBookmarks,
    isLoadingMore,
    hasMore,
    sentinelRef
  }
}
