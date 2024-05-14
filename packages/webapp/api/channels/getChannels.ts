import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'
import { PostgrestResponse } from '@supabase/supabase-js'

export type TChannel = Database['public']['Tables']['channels']['Row'] & {
  unread_message_count: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getChannels = async (workspaceId: string): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channels')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('type', 'THREAD')
    .order('last_activity_at', { ascending: false })
    .returns<TChannel[]>()
    .throwOnError()
}

export const getChannelsByWorkspaceAndUserids = async (
  workspaceId: string,
  userId: string
): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channel_members')
    .select('*, workspace:channel_id(*)')
    .eq('channel_id.workspace_id', workspaceId)
    .eq('member_id', userId)
    .returns<TChannel[]>()
    .throwOnError()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getChannelById = async (channelId: string): Promise<PostgrestResponse<any>> => {
  return (
    supabaseClient
      .from('channels')
      .select('*')
      // .eq("workspace_id", workspaceId)
      .eq('id', channelId)
      .returns<TChannel>()
      .single()
      .throwOnError()
  )
}
