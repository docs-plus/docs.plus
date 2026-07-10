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
 * Batch member previews for a whole visible page of owned documents in one RPC.
 * Keyed by the page's slugs; React Query hashes the key by value, so the raw
 * `docs.map(d => d.slug)` is stable without memoization.
 */
export function useDocumentMembers(slugs: string[]) {
  return useQuery({
    queryKey: ['document-members', slugs],
    enabled: slugs.length > 0,
    staleTime: 30_000,
    // Load more grows the slug set (new key); hold the prior map so clusters don't blink out.
    placeholderData: keepPreviousData,
    // await dispatches the lazy PostgrestBuilder (AGENTS.md §Supabase lazy rpc).
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
