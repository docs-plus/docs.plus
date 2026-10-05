import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { type DocumentsListScope, makeDocumentsKey } from '../documentsQueryKey'
import type { DocumentsPage } from '../types'
import { nextDocumentsOffset } from '../utils/documentsPageCache'

const DOCUMENTS_PAGE_SIZE = 20

async function fetchDocumentsPage(
  offset: number,
  { userId, scope, searchQuery, sortKey }: DocumentsListScope
): Promise<DocumentsPage> {
  // ownerId stays beside scope: an old server ignores scope and answers the owned list.
  const params = new URLSearchParams({
    limit: String(DOCUMENTS_PAGE_SIZE),
    offset: String(offset),
    ownerId: userId,
    scope,
    sort: sortKey
  })
  if (searchQuery) params.set('title', searchQuery)

  // The server reads the joined set from the token, and gates ownerId === token.sub.
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
 * The caller's live documents in one scope: owned, joined, or both. Sibling of
 * `useTrashedDocuments`. The page param is a ROW OFFSET, never a page index — see
 * `nextDocumentsOffset`. The scope must carry the DEBOUNCED search term, or the
 * optimistic patches miss this key.
 */
export function useOwnerDocuments(
  scope: DocumentsListScope,
  {
    refetchOnWindowFocus,
    keepPrevious = false,
    enabled = true
  }: { refetchOnWindowFocus?: boolean | 'always'; keepPrevious?: boolean; enabled?: boolean } = {}
) {
  return useInfiniteQuery({
    queryKey: makeDocumentsKey(scope),
    // AND, never override: no caller may fetch without a user.
    enabled: !!scope.userId && enabled,
    staleTime: 30_000,
    ...(refetchOnWindowFocus === undefined ? {} : { refetchOnWindowFocus }),
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchDocumentsPage(pageParam, scope),
    getNextPageParam: (lastPage, allPages) => nextDocumentsOffset(allPages, lastPage.total)
  })
}
