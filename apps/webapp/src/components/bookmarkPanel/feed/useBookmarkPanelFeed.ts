import { getUserBookmarks } from '@api'
import { loadBookmarkStats } from '@hooks/usePadBookmarkStats'
import { usePanelFeedSentinel } from '@hooks/usePanelFeedSentinel'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { type TBookmarkTab, type TBookmarkWithMessage } from '@types'
import { useCallback, useEffect, useState } from 'react'

import { BOOKMARK_PAGE_SIZE, bookmarkTabFetchParams } from '../utils/bookmarkTabQuery'

type UseBookmarkPanelFeedResult = {
  bookmarks: TBookmarkWithMessage[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  /** The first load failed; the panel shows an error state, not the empty one. */
  isError: boolean
  /** Reloads all three tabs. */
  retry: () => void
  sentinelRef: (node: HTMLDivElement | null) => void
}

export function useBookmarkPanelFeed(): UseBookmarkPanelFeedResult {
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const user = useAuthStore((state) => state.profile)
  const bookmarks = useChatStore((state) => state.bookmarks)
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const loadingBookmarks = useChatStore((state) => state.loadingBookmarks)
  const setBookmarks = useChatStore((state) => state.setBookmarks)
  const clearBookmarks = useChatStore((state) => state.clearBookmarks)
  const setLoadingBookmarks = useChatStore((state) => state.setLoadingBookmarks)
  const setBookmarkPage = useChatStore((state) => state.setBookmarkPage)
  const updateBookmarks = useChatStore((state) => state.updateBookmarks)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isError, setIsError] = useState(false)

  const currentBookmarks = bookmarks.get(bookmarkActiveTab) || []

  const refreshFeed = useCallback(async () => {
    const loadTab = (tab: TBookmarkTab) => {
      const { archived, markedAsRead } = bookmarkTabFetchParams(tab)
      return getUserBookmarks({
        workspaceId,
        archived,
        markedAsRead,
        limit: BOOKMARK_PAGE_SIZE,
        offset: 0
      })
    }

    try {
      await loadBookmarkStats(workspaceId)

      const [inProgressResult, archivedResult, readResult] = await Promise.all([
        loadTab('in progress'),
        loadTab('archive'),
        loadTab('read')
      ])

      for (const result of [inProgressResult, archivedResult, readResult]) {
        if (result.error) throw result.error
      }

      setBookmarks('in progress', inProgressResult.data ?? [])
      setBookmarks('archive', archivedResult.data ?? [])
      setBookmarks('read', readResult.data ?? [])
      setBookmarkPage(1)
      setIsError(false)
    } catch (error) {
      console.error('Error fetching bookmark feed:', error)
      setIsError(true)
    } finally {
      setLoadingBookmarks(false)
    }
  }, [workspaceId, setBookmarks, setBookmarkPage, setLoadingBookmarks])

  useEffect(() => {
    if (!user) return
    setLoadingBookmarks(true)
    clearBookmarks()
    void refreshFeed()
  }, [user, refreshFeed, clearBookmarks, setLoadingBookmarks])

  const retry = useCallback(() => {
    setLoadingBookmarks(true)
    void refreshFeed()
  }, [refreshFeed, setLoadingBookmarks])

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
      return data ?? []
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
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
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

  const sentinelRef = usePanelFeedSentinel({ hasMore, isLoadingMore, loadMore })

  return {
    bookmarks: currentBookmarks,
    isLoading: loadingBookmarks,
    isLoadingMore,
    hasMore,
    isError,
    retry,
    sentinelRef
  }
}
