import { useCallback } from 'react'
import { useChatStore } from '@stores'
import { TMsgRow } from '@types'

export const useReplyInMessageHandler = () => {
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const clearMemoryStates = useChatStore((state) => state.clearMemoryStates)

  const replyInMessageHandler = useCallback(
    async (message: TMsgRow) => {
      setReplyMessageMemory(message.channel_id, message)
      document.dispatchEvent(new CustomEvent('editor:focus'))
    },
    [setReplyMessageMemory, clearMemoryStates]
  )

  return { replyInMessageHandler }
}
