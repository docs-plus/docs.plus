import { useCallback } from 'react'
import * as toast from '@components/toast'
import { pinMessage } from '@api'
import { useChatStore } from '@stores'
import { TMsgRow } from '@types'
import { hasMetadataProperty } from '@utils/metadata'

export const usePinMessageHandler = () => {
  const addChannelPinnedMessage = useChatStore((state) => state.addChannelPinnedMessage)
  const removeChannelPinnedMessage = useChatStore((state) => state.removeChannelPinnedMessage)

  const pinMessageHandler = useCallback(async (message: TMsgRow) => {
    if (!message) return

    const actionType = hasMetadataProperty(message.metadata, 'pinned') ? 'unpin' : 'pin'
    const { error } = await pinMessage(message.channel_id, message.id, actionType)
    if (error) {
      toast.Error(`Message not ${actionType}`)
    } else {
      toast.Success(`Message ${actionType} successfully`)
      actionType === 'pin'
        ? addChannelPinnedMessage(message.channel_id, message)
        : removeChannelPinnedMessage(message.channel_id, message.id)

      // await workspaceBroadcaster.send({
      //   type: 'broadcast',
      //   event: 'pinnedMessage',
      //   payload: { message: messageData, actionType }
      // })
    }
  }, [])

  return { pinMessageHandler }
}
