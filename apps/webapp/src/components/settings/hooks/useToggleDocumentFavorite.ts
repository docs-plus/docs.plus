import * as toast from '@components/toast'
import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { type Rollback, useOwnerDocumentsCache } from './documentsCache'

export interface FavoriteToggleResult {
  documentId: string
  isFavorite: boolean
}

/**
 * PUT /documents/:documentId/favorite. The optimistic pin and its rollback are hook-level,
 * so a failed write still rolls back after the ⋮ menu or its phone sheet closes.
 */
const useToggleDocumentFavorite = (userId: string) => {
  const cache = useOwnerDocumentsCache(userId)
  const { isPending, mutate } = useMutation<
    FavoriteToggleResult,
    Error,
    { documentId: string; favorite: boolean },
    { rollback: Rollback | null }
  >({
    mutationKey: ['toggleDocumentFavorite'],
    mutationFn: async ({ documentId, favorite }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/favorite`
      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.token = session.access_token

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ favorite })
      })
      if (!response.ok) throw new Error('Failed to update favorite')

      const json = await response.json()
      if (!json.success || !json.data) throw new Error('Invalid favorite response')
      return json.data as FavoriteToggleResult
    },
    onMutate: async ({ documentId, favorite }) => ({
      rollback: await cache.setFavorite(documentId, favorite)
    }),
    onError: (_error, _variables, context) => {
      context?.rollback?.()
      toast.Error('Couldn’t update favorite')
    }
  })

  return { toggleFavorite: mutate, isPending }
}

export default useToggleDocumentFavorite
