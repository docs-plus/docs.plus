import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'

type TArchiveBookmark = {
  bookmarkId: number
  archive?: boolean
}

export const archiveBookmark = async ({
  bookmarkId,
  archive = true
}: TArchiveBookmark): Promise<PostgrestResponse<boolean>> => {
  return supabaseClient.rpc('archive_bookmark', {
    p_bookmark_id: bookmarkId,
    p_archive: archive
  })
}
