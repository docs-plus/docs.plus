import { supabaseClient } from '@utils/supabase'

export const pinMessage = async (channelId: string, messageId: string, actionType: string) => {
  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser()

  if (error) {
    throw error
  }

  if (!user) throw new Error('User not found')

  if (actionType === 'unpin')
    return await supabaseClient
      .from('pinned_messages')
      .delete()
      .eq('message_id', messageId)
      .eq('channel_id', channelId)
      .throwOnError()

  return await supabaseClient
    .from('pinned_messages')
    .insert({
      channel_id: channelId,
      pinned_by: user.id,
      message_id: messageId,
      pinned_at: new Date().toISOString()
    })
    .select()
    .throwOnError()
}
