import { PostgrestResponse } from '@supabase/supabase-js'
import { TFToggleMessageBookmark } from '@types'
import { supabaseClient } from '@utils/supabase'

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
