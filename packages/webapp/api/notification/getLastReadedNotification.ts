import { PostgrestResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TNotification = Database['public']['Tables']['notifications']['Row']

export const getLastReadedNotification = async (
  userId: string
): Promise<
  PostgrestResponse<TNotification & { sender: Database['public']['Tables']['users']['Row'] }>
> => {
  return supabaseClient
    .from('notifications')
    .select(
      `
      *,
      sender:sender_user_id(id,avatar_updated_at, avatar_url, display_name, full_name, username)
    `
    )
    .eq('receiver_user_id', userId)
    .not('readed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(6)
    .throwOnError()
}

export const getPaginatedLastReadedNotifications = async (
  userId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<
  PostgrestResponse<TNotification & { sender: Database['public']['Tables']['users']['Row'] }>
> => {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return supabaseClient
    .from('notifications')
    .select(
      `
      *,
      sender:sender_user_id(id,avatar_updated_at, avatar_url, display_name, full_name, username)
    `
    )
    .eq('receiver_user_id', userId)
    .not('readed_at', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to)
    .throwOnError()
}
