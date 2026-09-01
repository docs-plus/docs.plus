import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

export interface FavoriteToggleResult {
  documentId: string
  isFavorite: boolean
}

/**
 * PUT /documents/:documentId/favorite. Cache reorder lives in the menu so
 * the open ⋮ (same as Duplicate) still sees mutate-scoped callbacks.
 */
const useToggleDocumentFavorite = () => {
  const { isPending, mutate } = useMutation<
    FavoriteToggleResult,
    Error,
    { documentId: string; favorite: boolean }
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
    }
  })

  return { toggleFavorite: mutate, isPending }
}

export default useToggleDocumentFavorite
