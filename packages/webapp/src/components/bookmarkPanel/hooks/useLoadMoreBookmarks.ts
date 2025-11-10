import { useCallback } from 'react'
import { useApi } from '@hooks/useApi'
import { getUserBookmarks } from '@api'
import { useChatStore, useStore } from '@stores'

export const useLoadMoreBookmarks = () => {
  const { workspaceId } = useStore((state) => state.settings)
  const {
    bookmarkActiveTab,
    bookmarkPage,
    bookmarks,
    setBookmarks,
    setBookmarkPage,
    setLoadingBookmarks
  } = useChatStore((state) => state)

  const { request } = useApi(getUserBookmarks, null, false)

  const loadMore = useCallback(async () => {
    if (!workspaceId) return

    setLoadingBookmarks(true)
    try {
      const archived = bookmarkActiveTab === 'archive'
      const { data, error } = await request({
        workspaceId,
        archived,
        limit: 20,
        offset: bookmarkPage * 20
      })

      if (error) throw error

      const currentBookmarks = bookmarks.get(bookmarkActiveTab) || []
      const newBookmarks = [...currentBookmarks, ...(data || [])]
      setBookmarks(bookmarkActiveTab, newBookmarks as any)
      setBookmarkPage(bookmarkPage + 1)
    } catch (error) {
      console.error('Error loading more bookmarks:', error)
    } finally {
      setLoadingBookmarks(false)
    }
  }, [
    bookmarkActiveTab,
    bookmarkPage,
    bookmarks,
    workspaceId,
    request,
    setBookmarks,
    setBookmarkPage,
    setLoadingBookmarks
  ])

  const lastPage = false // Implement logic to determine if it's the last page

  return { loadMore, lastPage }
}
