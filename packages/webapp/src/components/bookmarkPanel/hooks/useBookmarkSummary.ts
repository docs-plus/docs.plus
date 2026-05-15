import { getBookmarkStats, getUserBookmarks } from '@api'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useEffect } from 'react'

export const useBookmarkSummary = () => {
  const workspaceId = useStore((state) => state.settings.workspaceId)
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

  useEffect(() => {
    if (!user) return
    setLoadingBookmarks(true)
    clearBookmarks()

    const fetchBookmarkSummary = async () => {
      try {
        // Get bookmark stats. `workspaceId` may be undefined during initial
        // doc bootstrap; the RPC treats null as "all workspaces" (see
        // get_user_bookmarks: `p_workspace_id is null or w.id = p_workspace_id`).
        // Passing null is the correct behavior — the user's bookmarks across
        // workspaces all surface, then the panel filters/groups them.
        const { data: statsData, error: statsError } = await statsRequest({ workspaceId })
        if (statsError) throw statsError

        // Get in progress bookmarks (not archived and not marked as read)
        const { data: inProgressData, error: inProgressError } = await inProgressRequest({
          workspaceId,
          archived: false,
          limit: 20
        })

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
    // Panel mounts fresh on every open (PopoverContent returns null when
    // closed), so `isOpen` is always true here — kept off the deps. Adding
    // it back re-introduces a fragile chain through React.lazy + Popover
    // context propagation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId])
}
