import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'
import { TFToggleMessageBookmark } from '@types'

type TToggleMessageBookmark = {
  messageId: string
}

export const toggleMessageBookmark = async ({
  messageId
}: TToggleMessageBookmark): Promise<PostgrestResponse<TFToggleMessageBookmark['Returns']>> => {
  return supabaseClient.rpc('toggle_message_bookmark', {
    p_message_id: messageId
  })
}
