import { supabaseClient } from '@utils/supabase'

/** Null on error, not 0: a zero would clear the app icon badge on a failed fetch. */
export const getUnreadNotificationCount = async (arg: {
  workspace_id: string | null
}): Promise<number | null> => {
  const response = await supabaseClient.rpc('get_unread_notif_count', {
    _workspace_id: arg.workspace_id || null
  })

  if (response.error) {
    console.error('Error fetching notification count:', response.error)
    return null
  }

  return response.data ?? 0
}
