import { useCallback } from 'react'
import { useChatStore, useStore } from '@stores'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'

const useOpenChatContainer = () => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const openChatContainerHandler = useCallback(
    (item: any, data?: any) => {
      if (!editor) return

      PubSub.publish(CHAT_OPEN, {
        headingId: item.id,
        ...(data ?? {})
      })
    },
    [editor, headingId]
  )

  return openChatContainerHandler
}

export default useOpenChatContainer
