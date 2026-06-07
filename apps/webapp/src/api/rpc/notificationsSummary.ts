import { PostgrestResponse } from '@supabase/supabase-js'
import { TNotificationSummary } from '@types'
import { supabaseClient } from '@utils/supabase'

type TNotificationsSummary = {
  workspaceId?: string | null
}

export const getNotificationsSummary = async ({
  workspaceId = null
}: TNotificationsSummary = {}): Promise<PostgrestResponse<TNotificationSummary>> => {
  return supabaseClient.rpc('notifications_summary', {
    _workspace_id: workspaceId
  })
}
