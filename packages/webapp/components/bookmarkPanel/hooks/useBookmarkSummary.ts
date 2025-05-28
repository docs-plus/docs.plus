import { useEffect } from 'react'
import { useApi } from '@hooks/useApi'
import { getBookmarkStats, getUserBookmarks } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'

export const useBookmarkSummary = () => {
  const { workspaceId } = useStore((state) => state.settings)
  const user = useAuthStore((state) => state.profile)
  const {
    setBookmarkSummary,
    setBookmarks,
    clearBookmarks,
    setLoadingBookmarks,
    setBookmarkTab,
    setBookmarkPage
  } = useChatStore((state) => state)
  const { request: statsRequest } = useApi(getBookmarkStats, null, false)
  const { request: inProgressRequest } = useApi(getUserBookmarks, null, false)
  const { request: archivedRequest } = useApi(getUserBookmarks, null, false)
  const { request: readRequest } = useApi(getUserBookmarks, null, false)

  useEffect(() => {
    if (!user || !workspaceId) return
    setLoadingBookmarks(true)
    clearBookmarks()

    const fetchBookmarkSummary = async () => {
      try {
        // Get bookmark stats
        const { data: statsData, error: statsError } = await statsRequest({ workspaceId })
        if (statsError) throw statsError

        // Get in progress bookmarks (not archived and not marked as read)
        const { data: inProgressData, error: inProgressError } = await inProgressRequest({
          workspaceId,
          archived: false,
          limit: 20
        })

        console.log('inProgressData', inProgressData)

        if (inProgressError) throw inProgressError

        // Get archived bookmarks
        const { data: archivedData, error: archivedError } = await archivedRequest({
          workspaceId,
          archived: true,
          limit: 20
        })
        if (archivedError) throw archivedError

        // Filter for read bookmarks from in progress data
        const readBookmarks = (inProgressData || []).filter(
          (bookmark: any) => bookmark.bookmark_marked_at
        )
        const unreadBookmarks = (inProgressData || []).filter(
          (bookmark: any) => !bookmark.bookmark_marked_at
        )

        if (statsData) {
          const summaryData = Array.isArray(statsData) ? statsData[0] : statsData
          setBookmarkSummary(summaryData)
          setBookmarkTab('in progress', summaryData.unread || 0)
          setBookmarkTab('archive', summaryData.archived || 0)
          setBookmarkTab('read', summaryData.read || 0)
        }

        setBookmarks('in progress', unreadBookmarks as any)
        setBookmarks('archive', archivedData as any)
        setBookmarks('read', readBookmarks as any)
        setBookmarkPage(1)
      } catch (error) {
        console.error('Error fetching bookmark summary:', error)
      } finally {
        setLoadingBookmarks(false)
      }
    }

    fetchBookmarkSummary()
  }, [user, workspaceId])
}
