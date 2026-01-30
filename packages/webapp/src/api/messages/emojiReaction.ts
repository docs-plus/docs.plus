import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'

export const emojiReaction = async (message: any, newReaction: string) => {
  const user = useAuthStore.getState().profile

  if (!user) return

  const updatedMessage = {
    ...message,
    reactions: message.reactions ? { ...message.reactions } : {}
  }

  const findReaction = updatedMessage.reactions && updatedMessage.reactions[newReaction]

  if (findReaction) {
    // Clone the array before modifying it
    const findReactionClone = [...findReaction]
    const findUser = findReactionClone.find((reaction: any) => reaction.user_id === user.id)

    if (findUser) {
      const index = findReactionClone.indexOf(findUser)
      findReactionClone.splice(index, 1)

      if (findReactionClone.length === 0) {
        delete updatedMessage.reactions[newReaction]
      } else {
        updatedMessage.reactions[newReaction] = findReactionClone
      }
    } else {
      // If the user hasn't reacted yet, push the reaction to the cloned array
      findReactionClone.push({ user_id: user.id, created_at: new Date().toISOString() })
      updatedMessage.reactions[newReaction] = findReactionClone
    }
  } else {
    // Handle the case for a new reaction
    updatedMessage.reactions[newReaction] = [
      { user_id: user.id, created_at: new Date().toISOString() }
    ]
  }

  return await supabaseClient
    .from('messages')
    .update({ reactions: updatedMessage.reactions })
    .eq('channel_id', updatedMessage.channel_id)
    .eq('id', message.id)
    .select()
    .throwOnError()
}

export const removeReaction = async (message: any, reaction: string) => {
  const user = useAuthStore.getState().profile

  if (!user) return

  const updatedMessage = {
    ...message,
    reactions: message.reactions ? { ...message.reactions } : {}
  }

  const findReaction = updatedMessage.reactions && updatedMessage.reactions[reaction]

  if (findReaction) {
    // Clone the array before modifying it
    const findReactionClone = [...findReaction]
    const findUser = findReactionClone.find((reaction: any) => reaction.user_id === user.id)

    if (findUser) {
      const index = findReactionClone.indexOf(findUser)
      findReactionClone.splice(index, 1)

      if (findReactionClone.length === 0) {
        delete updatedMessage.reactions[reaction]
      } else {
        updatedMessage.reactions[reaction] = findReactionClone
      }
    }
  }

  return await supabaseClient
    .from('messages')
    .update({ reactions: updatedMessage.reactions })
    .eq('channel_id', updatedMessage.channel_id)
    .eq('id', message.id)
    .select()
    .throwOnError()
}
