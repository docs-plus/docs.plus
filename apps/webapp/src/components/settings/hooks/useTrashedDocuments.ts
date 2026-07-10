import { useInfiniteQuery } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { makeTrashKey } from '../documentsQueryKey'
import type { DocumentsPage } from '../types'

const TRASH_PAGE_SIZE = 20

// `deleted=true` auto-scopes to the token subject server-side (never a client ownerId);
// rows come back ordered deletedAt desc with deletedAt populated.
async function fetchTrashPage(pageParam: number): Promise<DocumentsPage> {
  const params = new URLSearchParams({
    limit: String(TRASH_PAGE_SIZE),
    offset: String(pageParam * TRASH_PAGE_SIZE),
    deleted: 'true'
  })

  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers.token = session.access_token

  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents?${params}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`Failed to fetch trash: ${response.status}`)
  const json = await response.json()
  return json.data as DocumentsPage
}

/**
 * The owner's soft-deleted documents, paginated. Mounts when Trash opens, so
 * `refetchOnMount: 'always'` keeps it fresh — a doc just deleted from the live
 * list is guaranteed to appear instead of a stale (possibly empty) cache.
 */
export function useTrashedDocuments(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: makeTrashKey(userId ?? ''),
    enabled: !!userId,
    refetchOnMount: 'always',
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchTrashPage(pageParam),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const nextOffset = (lastPageParam + 1) * TRASH_PAGE_SIZE
      return nextOffset < lastPage.total ? lastPageParam + 1 : undefined
    }
  })
}
