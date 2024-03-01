import { createClient } from '@utils/supabase/components'
import { Database } from '@types'
import { PostgrestResponse } from '@supabase/postgrest-js'

export type TChannel = Database['public']['Tables']['channels']['Row']

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getChannels = async (workspaceId: string): Promise<PostgrestResponse<any>> => {
  const supabaseClient = createClient()
  return supabaseClient
    .from('channels')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('last_activity_at', { ascending: false })
    .returns<TChannel[]>()
    .throwOnError()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getChannelById = async (
  channelId: string,
  workspaceId: string
): Promise<PostgrestResponse<any>> => {
  const supabaseClient = createClient()

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
