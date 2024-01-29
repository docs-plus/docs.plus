import { useStore, useChatStore } from '@stores'
import { groupedMessages } from '@utils/groupMessages'

const getChannelMessages = (channelId: string): any => {
  const messagesByChannel = useChatStore.getState().messagesByChannel
  return messagesByChannel.get(channelId)
}

export const messageInsert = (payload: any) => {
  const { headingId: channelId } = useChatStore.getState().chatRoom
  const setOrUpdateMessage = useChatStore.getState().setOrUpdateMessage
  const usersPresence = useStore.getState().usersPresence

  if (!channelId) return

  const messages = getChannelMessages(channelId || '')
  const userdata = usersPresence.get(payload.new.user_id)
  const reply_to_message_id = messages?.get(payload.new.reply_to_message_id)
  // TODO: reply message user id

  if (payload.new.deleted_at) return

  const newMessage = {
    ...payload.new,
    user_details: userdata,
    replied_message_details: reply_to_message_id && {
      message: reply_to_message_id,
      user: reply_to_message_id?.user_details
    }
  }

  // if there is no messages, just add the message
  if (!messages) return setOrUpdateMessage(channelId, payload.new.id, newMessage)

  const msgs = [...getChannelMessages(channelId)?.values()]

  // get last message and check if the last message is from the same user
  const lastMessage0 = msgs.pop()
  const lastMessage1 = msgs.pop()

  // if the last message is from the same user, we need to group the messages
  const newInstanceOfMessages = groupedMessages([lastMessage1, lastMessage0, newMessage])

  setOrUpdateMessage(channelId, lastMessage0.id, newInstanceOfMessages.at(1))
  setOrUpdateMessage(channelId, newMessage.id, newInstanceOfMessages.at(2))
}
