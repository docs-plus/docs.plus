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
 * Batch member previews for a page of owned docs. `enabled` is required: the RPC
 * is revoked from `anon`, so an unguarded call 403s. React Query hashes slugs by
 * value, so `docs.map` needs no memo.
 */
export function useDocumentMembers(slugs: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['document-members', slugs],
    enabled: enabled && slugs.length > 0,
    staleTime: 30_000,
    // Load more grows the slug set (new key); hold the prior map so clusters don't blink out.
    placeholderData: keepPreviousData,
    // await dispatches the lazy PostgrestBuilder (packages/supabase/CLAUDE.md §Supabase — lazy rpc).
    queryFn: async () => {
      const res = await supabaseClient.rpc('get_document_member_previews', { p_slugs: slugs })
      if (res.error) throw res.error
      const map = new Map<string, DocumentMembersEntry>()
      for (const row of res.data ?? []) {
        map.set(row.slug, {
          member_count: Number(row.member_count),
          previews: (row.previews as unknown as DocumentMemberPreview[]) ?? []
        })
      }
      return map
    }
  })
}
