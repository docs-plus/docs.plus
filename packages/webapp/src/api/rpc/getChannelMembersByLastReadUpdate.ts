import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'

export type ChannelMemberReadUpdate = {
  user_id: string
  username: string
  full_name: string | null
  display_name: string
  avatar_url: string | null
  avatar_updated_at: string | null
  last_read_update_at: string
}

export const getChannelMembersByLastReadUpdate = async (
  channelId: string,
  timestamp: string
): Promise<PostgrestResponse<ChannelMemberReadUpdate[]>> => {
  return supabaseClient.rpc('get_channel_members_by_last_read_update', {
    _channel_id: channelId,
    _timestamp: timestamp
  })
}
