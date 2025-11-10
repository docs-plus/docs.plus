import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'

export const markReadMessages = async (arg: {
  channelId: string
  lastMessage: string
}): Promise<PostgrestResponse<any>> => {
  return supabaseClient.rpc('mark_messages_as_read', {
    p_channel_id: arg.channelId,
    p_message_id: arg.lastMessage
  })
}
