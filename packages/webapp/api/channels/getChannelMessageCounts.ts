import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'
import { PostgrestResponse } from '@supabase/supabase-js'
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
