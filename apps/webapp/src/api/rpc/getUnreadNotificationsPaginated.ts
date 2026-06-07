import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type _TUnreadNotifPaginatedReturn =
  Database['public']['Functions']['get_unread_notifications_paginated']['Returns']

type TUnreadNotifPaginated = {
  workspaceId?: string | null
  type?: Database['public']['Enums']['notification_category'] | null
  page: number
  size: number
}

export const getUnreadNotificationsPaginated = async (
  arg: TUnreadNotifPaginated
): Promise<PostgrestResponse<any>> => {
  return supabaseClient.rpc('get_unread_notifications_paginated', {
    _workspace_id: arg.workspaceId || null,
    _type: arg.type || null,
    _page: arg.page,
    _page_size: arg.size
  })
}
