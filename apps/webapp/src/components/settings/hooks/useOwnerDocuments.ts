import { useInfiniteQuery } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { type DocumentsListScope, makeDocumentsKey } from '../documentsQueryKey'
import type { DocumentsPage } from '../types'
import { nextDocumentsOffset } from '../utils/documentsPageCache'

const DOCUMENTS_PAGE_SIZE = 20

async function fetchDocumentsPage(
  offset: number,
  { userId, searchQuery, sortKey }: DocumentsListScope
): Promise<DocumentsPage> {
  const params = new URLSearchParams({
    limit: String(DOCUMENTS_PAGE_SIZE),
    offset: String(offset),
    ownerId: userId,
    sort: sortKey
  })
  if (searchQuery) params.set('title', searchQuery)

  // Owner-scoped list requires the token so the backend can gate ownerId === token.sub.
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers.token = session.access_token

  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents?${params}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`Failed to fetch documents: ${response.status}`)
  const json = await response.json()
  return json.data as DocumentsPage
}

/**
 * The owner's live documents. Sibling of `useTrashedDocuments`, so the two lists read
 * alike. The page param is a ROW OFFSET, never a page index — see `nextDocumentsOffset`.
 * The scope must carry the DEBOUNCED search term, or the optimistic patches miss this key.
 */
export function useOwnerDocuments(scope: DocumentsListScope) {
  return useInfiniteQuery({
    queryKey: makeDocumentsKey(scope),
    enabled: !!scope.userId,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchDocumentsPage(pageParam, scope),
    getNextPageParam: (lastPage, allPages) => nextDocumentsOffset(allPages, lastPage.total)
  })
}
