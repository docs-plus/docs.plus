import { useQuery } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

export interface DocumentRosterMember {
  member_id: string
  username: string | null
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
  joined_at: string
  last_visit_at: string
  is_caller: boolean
}

/**
 * Full member roster for one document, fetched lazily when the roster popover opens
 * (its host only mounts inside PopoverContent). Cached per slug.
 */
export function useDocumentRoster(slug: string) {
  return useQuery({
    queryKey: ['document-roster', slug],
    enabled: !!slug,
    staleTime: 30_000,
    // await dispatches the lazy PostgrestBuilder (AGENTS.md §Supabase lazy rpc).
    queryFn: async () => {
      const res = await supabaseClient.rpc('get_document_members', { p_slug: slug })
      if (res.error) throw res.error
      return (res.data ?? []) as unknown as DocumentRosterMember[]
    }
  })
}
