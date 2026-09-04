import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

/**
 * `found` from an UPDATE-only write: `true` when a membership row matched, and
 * `false` when none did. A write that changed nothing is not an `error`.
 */
type TSetDocumentFollowReturn = boolean

type TSetDocumentFollowParams = {
  documentId: string
  follow: boolean
}

export const setDocumentFollow = async (
  arg: TSetDocumentFollowParams
): Promise<PostgrestSingleResponse<TSetDocumentFollowReturn>> => {
  // documentId verbatim. The RPC matches workspace_members.workspace_id, never the
  // lowercased workspaces.slug that get_document_members takes.
  // await dispatches the lazy PostgrestBuilder (packages/supabase/CLAUDE.md §Supabase — lazy rpc).
  return await supabaseClient.rpc('set_document_follow', {
    p_document_id: arg.documentId,
    p_follow: arg.follow
  })
}
