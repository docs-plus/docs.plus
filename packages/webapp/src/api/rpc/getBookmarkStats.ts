import { PostgrestResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

type TGetBookmarkStats = {
  workspaceId?: string
}

type TBookmarkStats = {
  total: number
  archived: number
  active: number
  unread: number
  read: number
}

export const getBookmarkStats = async ({ workspaceId }: TGetBookmarkStats = {}): Promise<
  PostgrestResponse<TBookmarkStats>
> => {
  return supabaseClient.rpc('get_bookmark_stats', {
    p_workspace_id: workspaceId || null
  })
}
