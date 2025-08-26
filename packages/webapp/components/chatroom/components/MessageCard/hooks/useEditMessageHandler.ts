import { useCallback } from 'react'
import { useChatStore } from '@stores'
import { TMsgRow } from '@types'

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
