import { supabaseClient } from '@utils/supabase'

export const markAllNotificationsAsRead = async (userId: string) => {
  return supabaseClient
    .from('notifications')
    .update({ readed_at: new Date().toISOString() })
    .eq('receiver_user_id', userId)
    .is('readed_at', null)
    .throwOnError()
}
