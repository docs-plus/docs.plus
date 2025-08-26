import { useCallback } from 'react'
import { toggleMessageBookmark } from '@api'
import { useChatStore } from '@stores'
import { useApi } from '@hooks/useApi'
import * as toast from '@components/toast'
import { TMsgRow } from '@types'

export const useBookmarkMessageHandler = () => {
  const setOrUpdateMessage = useChatStore((state) => state.setOrUpdateMessage)

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

      if (data) {
        setOrUpdateMessage(message.channel_id, message.id, {
          // @ts-ignore
          bookmark_id: data.action === 'added' ? data.bookmark_id : null,
          // @ts-ignore
          is_bookmarked: data.action === 'added' ? true : false
        })
      }
      // @ts-ignore
      toast.Success(data?.action === 'added' ? 'Bookmark added' : 'Bookmark removed')
    },
    [toggleBookmark, setOrUpdateMessage]
  )

  return {
    bookmarkMessageHandler,
    bookmarkLoading
  }
}
