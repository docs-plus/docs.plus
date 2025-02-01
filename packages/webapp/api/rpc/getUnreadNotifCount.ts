import { supabaseClient } from '@utils/supabase'

export const getUnreadNotificationCount = async (arg: {
  workspace_id: string | null
}): Promise<number> => {
  const response = await supabaseClient.rpc('get_unread_notif_count', {
    _workspace_id: arg.workspace_id || null
  })

  if (response.error) {
    console.error('Error fetching notification count:', response.error)
    return 0
  }

  return response.data ?? 0
}
