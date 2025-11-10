import { supabaseClient } from '@utils/supabase'
export const markNotificationAsRead = async (notificationId: string) => {
  return supabaseClient
    .from('notifications')
    .update({ readed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .throwOnError()
}
