import { PostgrestResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

export const searchWorkspaceUsers = async (arg: {
  workspaceId: string
  username: string
}): Promise<PostgrestResponse<any>> => {
  return supabaseClient.rpc('fetch_mentioned_users', {
    _workspace_id: arg.workspaceId,
    _username: arg.username || ''
  })
}
