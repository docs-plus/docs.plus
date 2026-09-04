import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

/**
 * Read `error` first, because a transport failure also leaves `data` null.
 * Then never `Boolean(data)`: `true` follows, `false` is muted, `null` means no membership.
 */
type TDocumentFollowStateReturn = boolean | null

type TDocumentFollowStateParams = {
  documentId: string
}

export const getDocumentFollowState = async (
  arg: TDocumentFollowStateParams
): Promise<PostgrestSingleResponse<TDocumentFollowStateReturn>> => {
  // documentId verbatim. The RPC matches workspace_members.workspace_id, never the
  // lowercased workspaces.slug that get_document_members takes.
  // await dispatches the lazy PostgrestBuilder (packages/supabase/CLAUDE.md §Supabase — lazy rpc).
  return await supabaseClient.rpc('get_document_follow_state', {
    p_document_id: arg.documentId
  })
}
