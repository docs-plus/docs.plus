import * as toast from '@components/toast'
import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { useOwnerDocumentsCache } from './documentsCache'

// The backend resets isPrivate and readOnly, and returns only these three fields.
export interface DuplicatedDocument {
  documentId: string
  slug: string
  title: string
}

/**
 * POST /documents/:documentId/duplicate (strict owner). The toast and the list refresh are
 * hook-level, so they still run when the ⋮ menu or its phone sheet closes mid-request.
 * `name` rides the variables: hook-level callbacks keep the options of the last render.
 */
const useDuplicateDocument = (userId: string) => {
  const cache = useOwnerDocumentsCache(userId)
  const { isPending, mutate } = useMutation<
    DuplicatedDocument,
    Error,
    { documentId: string; name: string },
    { toastId: string }
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
    },
    onMutate: () => ({ toastId: toast.Loading('Duplicating…') }),
    onSuccess: (copy, { name }, { toastId }) => {
      cache.addDuplicate()
      toast.Success(`Copy of “${name}” created`, {
        id: toastId,
        actionLabel: 'Open',
        onAction: () => window.open(`/${copy.slug}`, '_blank')
      })
    },
    onError: (_error, _variables, context) =>
      toast.Error('Couldn’t duplicate document', { id: context?.toastId })
  })

  return { duplicate: mutate, isPending }
}

export default useDuplicateDocument
