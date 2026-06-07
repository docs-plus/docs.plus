import { useChatStore } from '@stores'
import { TMsgRow } from '@types'
import { useCallback } from 'react'

export const useEditMessageHandler = () => {
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)

  const editMessageHandler = useCallback(
    (message: TMsgRow) => {
      if (!message) return

      setEditMessageMemory(message.channel_id, message)
    },
    [setEditMessageMemory]
  )

  return { editMessageHandler }
}
