import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/postgrest-js'
import { Database } from '@types'

export type TMessageInsert = Database['public']['Tables']['messages']['Insert']

export const forwardMessage = async (
  channel_id: string,
  user_id: string,
  origin_message_id: string
): Promise<PostgrestResponse<TMessageInsert>> => {
  return supabaseClient
    .from('messages')
    .insert({
      channel_id,
      user_id,
      origin_message_id
    })
    .single()
}
