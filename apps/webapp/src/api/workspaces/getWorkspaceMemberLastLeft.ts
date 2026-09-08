import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

/**
 * Last left: when this member's last live session on the document closed.
 * Null on a member who never left, and the whole row is null on an owner who
 * never joined. Neither is an error, so the caller reads `error` first.
 */
type TWorkspaceMemberLastLeftReturn = { last_connection_closed_at: string | null } | null

type TWorkspaceMemberLastLeftParams = {
  documentId: string
  memberId: string
}

export const getWorkspaceMemberLastLeft = async (
  arg: TWorkspaceMemberLastLeftParams
): Promise<PostgrestSingleResponse<TWorkspaceMemberLastLeftReturn>> => {
  // documentId verbatim: workspace_members.workspace_id holds the raw room name,
  // never the lowercased workspaces.slug. member_id is filtered here because
  // workspace_members_select shows every co-member's row, not just my own.
  return await supabaseClient
    .from('workspace_members')
    .select('last_connection_closed_at')
    .eq('workspace_id', arg.documentId)
    .eq('member_id', arg.memberId)
    .maybeSingle()
}
