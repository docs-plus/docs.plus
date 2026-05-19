import { PostgrestResponse } from '@supabase/supabase-js'
import type { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type FetchMentionedUsersRow =
  Database['public']['Functions']['fetch_mentioned_users']['Returns'][number]

export const searchWorkspaceUsers = async (arg: {
  workspaceId: string
  username: string
}): Promise<PostgrestResponse<FetchMentionedUsersRow>> => {
  return supabaseClient.rpc('fetch_mentioned_users', {
    _workspace_id: arg.workspaceId,
    _username: arg.username || ''
  })
}
