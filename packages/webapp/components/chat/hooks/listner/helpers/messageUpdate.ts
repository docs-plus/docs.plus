import { useChatStore, useStore } from '@stores'

const getChannelMessages = (channelId: string): any => {
  const messagesByChannel = useChatStore.getState().messagesByChannel
  return messagesByChannel.get(channelId)
}

export const messageUpdate = (payload: any) => {
  const channelId = payload.new.channel_id

  if (!channelId) return

  const messages = getChannelMessages(channelId)
  const setOrUpdateMessage = useChatStore.getState().setOrUpdateMessage
  const removeMessage = useChatStore.getState().removeMessage
  const usersPresence = useStore.getState().usersPresence
  const userdata = usersPresence.get(payload.new.user_id)
  const setLastMessage = useChatStore.getState().setLastMessage
  const lastMessages = useChatStore.getState().lastMessages.get(channelId)

  const reply_to_message_id = messages.get(payload.new.reply_to_message_id)
  // get the message
  const message = messages.get(payload.new.id)
  // update the message
  const updatedMessage = { ...message, ...payload.new }

  // update the messages map
  if (payload.new.deleted_at) {
    removeMessage(channelId, payload.new.id)
    if (lastMessages?.id === payload.new.id) {
      setLastMessage(channelId, null)
    }

    // TODO: if the message is pinned, we need to remove it from the pinned messages

    // TODO: if the message is the last message in a group (which have avatar), we need that group of messages
  } else {
    const newMessage = {
      ...updatedMessage,
      user_details: userdata || message.user_details,

      replied_message_details: reply_to_message_id && {
        message: reply_to_message_id,
        user: reply_to_message_id?.user_details
      }
    }

    setOrUpdateMessage(channelId, payload.new.id, newMessage)
  }
}
