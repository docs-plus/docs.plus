import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'

type TMarkBookmarkAsRead = {
  bookmarkId: number
  markAsRead?: boolean
}

export const markBookmarkAsRead = async ({
  bookmarkId,
  markAsRead = true
}: TMarkBookmarkAsRead): Promise<PostgrestResponse<boolean>> => {
  return supabaseClient.rpc('mark_bookmark_as_read', {
    p_bookmark_id: bookmarkId,
    p_mark_as_read: markAsRead
  })
}
