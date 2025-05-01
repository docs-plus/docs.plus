import { PostgrestResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TNotification = Database['public']['Tables']['notifications']['Row']

export const getLastReadedNotification = async (
  userId: string,
  workspaceId: string
): Promise<
  PostgrestResponse<TNotification & { sender: Database['public']['Tables']['users']['Row'] }>
> => {
  return supabaseClient
    .rpc('get_workspace_notifications', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_limit: 6,
      p_is_read: true
    })
    .throwOnError()
}

export const getPaginatedLastReadedNotifications = async (
  userId: string,
  workspaceId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<
  PostgrestResponse<TNotification & { sender: Database['public']['Tables']['users']['Row'] }>
> => {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return supabaseClient
    .rpc('get_workspace_notifications', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_offset: from,
      p_limit: pageSize,
      p_is_read: true
    })
    .throwOnError()
}
