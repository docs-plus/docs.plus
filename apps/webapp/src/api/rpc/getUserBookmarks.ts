import { PostgrestResponse } from '@supabase/supabase-js'
import { type TBookmarkWithMessage } from '@types'
import { supabaseClient } from '@utils/supabase'

type TGetUserBookmarks = {
  workspaceId?: string
  archived?: boolean
  limit?: number
  offset?: number
}

export const getUserBookmarks = async ({
  workspaceId,
  archived = false,
  limit = 50,
  offset = 0
}: TGetUserBookmarks): Promise<PostgrestResponse<TBookmarkWithMessage[]>> => {
  return supabaseClient.rpc('get_user_bookmarks', {
    p_workspace_id: workspaceId || null,
    p_archived: archived,
    p_limit: limit,
    p_offset: offset
  })
}
