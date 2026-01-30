import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'
type TChannelMessageCount = Database['public']['Tables']['channel_message_counts']['Row']

export const getChannelMessageCounts = async (
  workspaceId: string
): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channel_message_counts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .returns<TChannelMessageCount[]>()
    .throwOnError()
}
