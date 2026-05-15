import { toggleMessageBookmark } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMessage } from '@components/chatroom/types/chat-items'
import * as toast from '@components/toast'
import { useApi } from '@hooks/useApi'
import { TMsgRow } from '@types'
import { useCallback } from 'react'

/**
 * `toggle_message_bookmark` writes to the separate `message_bookmarks`
 * table, so realtime postgres_changes on `messages` doesn't fire (and
 * the bookmark fields are per-user anyway — a single message row can't
 * carry them). We patch the Virtuoso row in place from the RPC's
 * `{ action, bookmark_id }` response so the BookmarkIndicator and the
 * tinted-bg in MessageCardContext flip instantly.
 */
export const useBookmarkMessageHandler = () => {
  const { listRef } = useChatroomContext()
  const { request: toggleBookmark, loading: bookmarkLoading } = useApi(
    toggleMessageBookmark,
    null,
    false
  )

  const bookmarkMessageHandler = useCallback(
    async (message: TMsgRow) => {
      if (!message) return

      const { error, data } = await toggleBookmark({ messageId: message.id })

      if (error) {
        toast.Error('Failed to toggle bookmark')
        return
      }

      const payload = data as { action?: string; bookmark_id?: number | null } | null
      const added = payload?.action === 'added'
      const newBookmarkId = added ? (payload?.bookmark_id ?? null) : null

      listRef.current?.data.map((item) => {
        if (isMessage(item) && item.id === message.id) {
          return {
            ...item,
            row: {
              ...item.row,
              is_bookmarked: added,
              bookmark_id: newBookmarkId
            }
          }
        }
        return item
      })

      toast.Success(added ? 'Bookmark added' : 'Bookmark removed')
    },
    [toggleBookmark, listRef]
  )

  return {
    bookmarkMessageHandler,
    bookmarkLoading
  }
}
