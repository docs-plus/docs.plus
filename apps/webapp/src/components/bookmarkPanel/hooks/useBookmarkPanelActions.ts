import { archiveBookmark, markBookmarkAsRead, toggleMessageBookmark } from '@api'
import * as toast from '@components/toast'
import { useFeedItemExit } from '@hooks/useFeedItemExit'
import { useChatStore } from '@stores'
import { type TBookmarkWithMessage } from '@types'
import { useCallback } from 'react'

export function useBookmarkPanelActions() {
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const commitBookmarkRemoved = useChatStore((state) => state.commitBookmarkRemoved)
  const commitBookmarkMarkedRead = useChatStore((state) => state.commitBookmarkMarkedRead)
  const commitBookmarkArchived = useChatStore((state) => state.commitBookmarkArchived)
  const commitBookmarkRestored = useChatStore((state) => state.commitBookmarkRestored)
  const { isExiting, runWithExit } = useFeedItemExit<number>()

  const remove = useCallback(
    async (bookmark: TBookmarkWithMessage) => {
      if (!runWithExit(bookmark.bookmark_id, () => commitBookmarkRemoved(bookmark.bookmark_id))) {
        return
      }

      try {
        await toggleMessageBookmark({ messageId: bookmark.message_id })
      } catch (error) {
        console.error('Failed to remove bookmark:', error)
        toast.Error('Failed to remove bookmark')
      }
    },
    [commitBookmarkRemoved, runWithExit]
  )

  const markAsRead = useCallback(
    async (bookmark: TBookmarkWithMessage) => {
      if (bookmark.bookmark_marked_at || bookmark.bookmark_archived_at) return

      if (
        !runWithExit(bookmark.bookmark_id, () => commitBookmarkMarkedRead(bookmark.bookmark_id))
      ) {
        return
      }

      try {
        await markBookmarkAsRead({ bookmarkId: bookmark.bookmark_id, markAsRead: true })
      } catch (error) {
        console.error('Failed to mark bookmark:', error)
        toast.Error('Failed to mark bookmark')
      }
    },
    [commitBookmarkMarkedRead, runWithExit]
  )

  const archive = useCallback(
    async (bookmark: TBookmarkWithMessage) => {
      const isArchived = !!bookmark.bookmark_archived_at

      const onComplete = () => {
        if (isArchived) {
          commitBookmarkRestored(bookmark.bookmark_id)
        } else {
          commitBookmarkArchived(bookmark.bookmark_id, bookmarkActiveTab)
        }
      }

      if (!runWithExit(bookmark.bookmark_id, onComplete)) return

      try {
        await archiveBookmark({ bookmarkId: bookmark.bookmark_id, archive: !isArchived })
      } catch (error) {
        console.error('Failed to archive bookmark:', error)
        toast.Error('Failed to archive bookmark')
      }
    },
    [bookmarkActiveTab, commitBookmarkArchived, commitBookmarkRestored, runWithExit]
  )

  return { remove, markAsRead, archive, isExiting }
}
