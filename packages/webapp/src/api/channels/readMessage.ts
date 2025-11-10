import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TNewChannel = Database['public']['Tables']['channel_members']['Insert']

export const readMessage = async ({ channel_id, member_id, last_read_message_id }: TNewChannel) =>
  supabaseClient
    .from('channel_members')
    .update({
      last_read_message_id
    })
    .eq('channel_id', channel_id)
    .eq('member_id', member_id)
