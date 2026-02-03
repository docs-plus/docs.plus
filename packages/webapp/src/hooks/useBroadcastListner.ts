import { useChatStore, useStore } from '@stores'
import { useEffect } from 'react'

type TBroadcastPayload = {
  event: 'pinnedMessage'
  type: 'broadcast'
  payload: { actionType: 'pin' | 'unpin'; message: any }
}

type TTypeIndicator = {
  event: 'pinnedMessage'
  type: 'typingIndicator'
  payload: {
    activeChannelId: string
    user: any
    type: 'startTyping' | 'stopTyping'
  }
}

export const useBroadcastListner = () => {
  const { broadcaster } = useStore((state) => state.settings)
  const addChannelPinnedMessage = useChatStore((state) => state.addChannelPinnedMessage)
  const removeChannelPinnedMessage = useChatStore((state) => state.removeChannelPinnedMessage)

  const setTypingIndicator = useChatStore((state) => state.setTypingIndicator)
  const removeTypingIndicator = useChatStore((state) => state.removeTypingIndicator)
  const updateUserStatus = useStore((state) => state.updateUserStatus)

  useEffect(() => {
    if (!broadcaster) return
    broadcaster
      .on('broadcast', { event: 'pinnedMessage' }, ({ payload }: TBroadcastPayload) => {
        const message = payload.message
        const type = payload.actionType

        if (type === 'pin') {
          addChannelPinnedMessage(message.channel_id, message)
        } else if (type === 'unpin') {
          removeChannelPinnedMessage(message.channel_id, message.id)
        }
      })
      .on('broadcast', { event: 'typingIndicator' }, (data: TTypeIndicator) => {
        const payload = data.payload
        if (payload.type === 'startTyping') {
          setTypingIndicator(payload.activeChannelId, payload.user)
          // @ts-ignore
          updateUserStatus(payload.user.id, 'TYPING')
        } else if (payload.type === 'stopTyping') {
          removeTypingIndicator(payload.activeChannelId, payload.user)
          // @ts-ignore
          updateUserStatus(payload.user.id, 'ONLINE')
        }
      })
  }, [broadcaster])
}
