import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

export interface DocumentMemberPreview {
  member_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
}

export interface DocumentMembersEntry {
  member_count: number
  previews: DocumentMemberPreview[]
}

/**
 * Batch member previews for a page of docs, keyed on the documentId verbatim (`workspaces.id`).
 * Never a slug: old workspaces hold the human slug there (#574). `enabled` is required: the RPC
 * is revoked from `anon`, so an unguarded call 403s. React Query hashes ids by value.
 */
export function useDocumentMembers(documentIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['document-members', documentIds],
    enabled: enabled && documentIds.length > 0,
    staleTime: 30_000,
    // Load more grows the id set (new key); hold the prior map so clusters don't blink out.
    placeholderData: keepPreviousData,
    // await dispatches the lazy PostgrestBuilder (packages/supabase/CLAUDE.md §Supabase — lazy rpc).
    queryFn: async () => {
      const res = await supabaseClient.rpc('get_document_member_previews', {
        p_document_ids: documentIds
      })
      if (res.error) throw res.error
      const map = new Map<string, DocumentMembersEntry>()
      for (const row of res.data ?? []) {
        map.set(row.document_id, {
          member_count: Number(row.member_count),
          previews: row.previews ?? []
        })
      }
      return map
    }
  })
}
