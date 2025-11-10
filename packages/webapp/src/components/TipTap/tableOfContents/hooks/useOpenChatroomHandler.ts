import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { useCallback } from 'react'
import PubSub from 'pubsub-js'

const useOpenChatroomHandler = (tocId: string) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const openChatroom = useCallback(() => {
    if (!editor) return

    PubSub.publish(CHAT_OPEN, {
      headingId: tocId,
      scrollTo: true
    })
  }, [editor, headingId])
  return openChatroom
}

export default useOpenChatroomHandler
