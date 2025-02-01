import { PostgrestResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TNotification = Database['public']['Tables']['notifications']['Row']

export const getMentionNotifications = async (
  userId: string
): Promise<
  PostgrestResponse<TNotification & { sender: Database['public']['Tables']['users']['Row'] }>
> => {
  return supabaseClient
    .from('notifications')
    .select(
      `
      *,
      sender:sender_user_id(avatar_updated_at, avatar_url, display_name, full_name, username)
    `
    )
    .eq('receiver_user_id', userId)
    .eq('type', 'mention')
    .is('readed_at', null)
    .order('created_at', { ascending: false })
    .throwOnError()
}
