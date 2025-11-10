import { supabaseClient } from '@utils/supabase'

export const deleteMessage = async (channelId: string, messageId: string) =>
  await supabaseClient
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .eq('id', messageId)
    .select()
    .throwOnError()
