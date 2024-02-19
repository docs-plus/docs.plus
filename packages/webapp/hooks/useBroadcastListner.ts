import { useStore, useChatStore } from '@stores'
import { useEffect } from 'react'

type TPinnedMsg = {
  event: 'pinnedMessage'
  type: 'broadcast'
  payload: { actionType: 'pin' | 'unpin'; message: any }
}

export const useBroadcastListner = () => {
  const { broadcaster } = useStore((state) => state.settings)
  const addChannelPinnedMessage = useChatStore((state) => state.addChannelPinnedMessage)
  const removeChannelPinnedMessage = useChatStore((state) => state.removeChannelPinnedMessage)

  useEffect(() => {
    if (!broadcaster) return
    broadcaster.on('broadcast', { event: 'pinnedMessage' }, ({ payload }: TPinnedMsg) => {
      const message = payload.message
      if (payload.actionType === 'pin') {
        addChannelPinnedMessage(message.channel_id, message)
      } else if (payload.actionType === 'unpin') {
        removeChannelPinnedMessage(message.channel_id, message.id)
      }
    })
  }, [broadcaster])
}
