import { PostgrestResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

type TGetUserBookmarks = {
  workspaceId?: string
  archived?: boolean
  limit?: number
  offset?: number
}

type TUserDetails = {
  id: string
  username: string
  fullname: string
  avatar_url: string | null
  avatar_updated_at: string | null
}

type TBookmarkWithMessage = {
  bookmark_id: number
  bookmark_created_at: string
  bookmark_updated_at: string
  bookmark_archived_at: string | null
  bookmark_marked_at: string | null
  bookmark_metadata: Record<string, any>
  message_id: string
  message_content: string
  message_html: string
  message_created_at: string
  message_user_id: string
  message_channel_id: string
  message_type: string
  user_details: TUserDetails
  channel_name: string
  channel_slug: string
  workspace_id: string
  workspace_name: string
  workspace_slug: string
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
