import { useAuthStore, useChatStore, useStore } from '@stores'
import { groupedMessages } from '@utils/index'
import { getUserById, TUser } from '@api'
import { Profile } from '@types'

const getChannelMessages = (channelId: string): any => {
  const messagesByChannel = useChatStore.getState().messagesByChannel
  return messagesByChannel.get(channelId)
}

const fetchUserDetails = async (userId: string): Promise<Profile | null> => {
  try {
    const { data, error } = await getUserById(userId)

    if (error || !data) {
      console.info('[UserDetails] - user not found', { userId, error })
      return null
    }

    return data as Profile
  } catch (err) {
    console.info('[UserDetails] - fetch failed', { userId, err })
    return null
  }
}

export const messageInsert = async (payload: any) => {
  const channelId = payload.new.channel_id

  const removeMessage = useChatStore.getState().removeMessage
  const setOrUpdateMessage = useChatStore.getState().setOrUpdateMessage
  const setLastMessage = useChatStore.getState().setLastMessage
  const usersPresence = useStore.getState().usersPresence

  removeMessage(channelId, 'fake_id')

  if (!channelId) return

  const messages = getChannelMessages(channelId || '')
  let userdata = usersPresence.get(payload.new.user_id)

  // Fetch user details if not in presence store
  // Mosty this must hanndle by useOnAuthStateChange or useCatchUserPresences hook in realtime
  if (!userdata) {
    const fetchedUser = await fetchUserDetails(payload.new.user_id)
    if (fetchedUser) {
      useStore.getState().setOrUpdateUserPresence(payload.new.user_id, fetchedUser)
      userdata = fetchedUser
    }
  }

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
  if (!messages) {
    setLastMessage(channelId, newMessage)
    return setOrUpdateMessage(channelId, payload.new.id, newMessage)
  }

  const msgs = [...(getChannelMessages(channelId)?.values() ?? [])]

  // get last message and check if the last message is from the same user
  const lastMessage0 = msgs.pop()
  const lastMessage1 = msgs.pop()

  // if the last message is from the same user, we need to group the messages
  const newInstanceOfMessages = groupedMessages(
    [lastMessage1, lastMessage0, newMessage].filter(Boolean)
  )

  // TODO: do we need anymore this?!/!
  setLastMessage(channelId, newInstanceOfMessages.at(-1))

  if (lastMessage0) {
    setOrUpdateMessage(channelId, lastMessage0.id, newInstanceOfMessages.at(lastMessage1 ? 1 : 0))
  }
  setOrUpdateMessage(channelId, newMessage.id, newInstanceOfMessages.at(-1))
}
