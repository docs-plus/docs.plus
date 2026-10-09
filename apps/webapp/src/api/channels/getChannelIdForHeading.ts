import { supabaseClient } from '@utils/supabase'

/** The channel of one heading in one document (#402). Null when nobody has opened that chat yet. */
export const getChannelIdForHeading = async (
  workspaceId: string,
  headingId: string
): Promise<string | null> => {
  const { data } = await supabaseClient
    .from('channels')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('heading_id', headingId)
    .maybeSingle()
    .throwOnError()
  return data?.id ?? null
}
