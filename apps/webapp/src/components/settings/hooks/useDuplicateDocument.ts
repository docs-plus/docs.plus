import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

// Backend resets isPrivate/readOnly and returns only these three fields;
// the component synthesizes the rest of OwnedDocument for the cache prepend.
export interface DuplicatedDocument {
  documentId: string
  slug: string
  title: string
}

/**
 * POST /documents/:documentId/duplicate (strict owner). Same `token` header
 * convention as useUpdateDocMetadata; the cache prepend lives in the component.
 */
const useDuplicateDocument = () => {
  const { isPending, isSuccess, mutate, data } = useMutation<
    DuplicatedDocument,
    Error,
    { documentId: string }
  >({
    mutationKey: ['duplicateDocument'],
    mutationFn: async ({ documentId }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/duplicate`

      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.token = session.access_token

      const response = await fetch(url, { method: 'POST', headers })
      if (!response.ok) throw new Error('Failed to duplicate document')

      const json = await response.json()
      if (!json.success || !json.data) throw new Error('Invalid duplicate response')
      return json.data as DuplicatedDocument
    }
  })

  return { duplicate: mutate, isPending, isSuccess, data }
}

export default useDuplicateDocument
