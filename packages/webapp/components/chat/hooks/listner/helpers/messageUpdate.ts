import { useStore, useChatStore } from '@stores'

const getChannelMessages = (channelId: string): any => {
  const messagesByChannel = useChatStore.getState().messagesByChannel
  return messagesByChannel.get(channelId)
}

export const messageUpdate = (payload: any) => {
  const { headingId: channelId } = useChatStore.getState().chatRoom
  if (!channelId) return

  const messages = getChannelMessages(channelId)
  const setOrUpdateMessage = useChatStore.getState().setOrUpdateMessage
  const removeMessage = useChatStore.getState().removeMessage
  const usersPresence = useStore.getState().usersPresence
  const userdata = usersPresence.get(payload.new.user_id)

  const reply_to_message_id = messages.get(payload.new.reply_to_message_id)
  // get the message
  const message = messages.get(payload.new.id)
  // update the message
  const updatedMessage = { ...message, ...payload.new }
  // update the messages map
  if (payload.new.deleted_at) {
    removeMessage(channelId, payload.new.id)
  } else {
    const newMessage = {
      ...updatedMessage,
      user_details: userdata,
      user_id: userdata,
      replied_message_details: reply_to_message_id && {
        message: reply_to_message_id,
        user: reply_to_message_id?.user_details
      }
    }

    setOrUpdateMessage(channelId, payload.new.id, newMessage)
  }
}
