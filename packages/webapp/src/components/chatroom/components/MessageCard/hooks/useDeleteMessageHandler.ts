import { deleteMessage } from '@api'
import { useCallback } from 'react'
import * as toast from '@components/toast'
import { TMsgRow } from '@types'

export const useDeleteMessageHandler = () => {
  const deleteMessageHandler = useCallback(async (message: TMsgRow) => {
    if (!message) return
    const { error } = await deleteMessage(message.channel_id, message.id)
    if (error) toast.Error('Message not deleted')
    else toast.Success('Message deleted')
  }, [])

  return { deleteMessageHandler }
}
