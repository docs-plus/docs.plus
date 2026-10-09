import { supabaseClient } from '@utils/supabase'

/** The heading of a channel, only when that channel belongs to this document (#402). */
export const getHeadingIdForChannel = async (
  workspaceId: string,
  channelId: string
): Promise<string | null> => {
  const { data } = await supabaseClient
    .from('channels')
    .select('heading_id')
    .eq('workspace_id', workspaceId)
    .eq('id', channelId)
    .maybeSingle()
    .throwOnError()
  return data?.heading_id ?? null
}
