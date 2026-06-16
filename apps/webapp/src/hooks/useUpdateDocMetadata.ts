import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

interface UpdateDocMetadataParams {
  title?: string
  description?: string
  keywords?: string[]
  documentId: string
  readOnly?: boolean
}

interface UpdateDocMetadataResponse {
  id: string
  title: string
  description: string
  keywords: string[]
  readOnly: boolean
}

const useUpdateDocMetadata = () => {
  const queryClient = useQueryClient()

  const { isPending, isSuccess, mutate, data } = useMutation<
    UpdateDocMetadataResponse,
    Error,
    UpdateDocMetadataParams
  >({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: async ({ title, description, keywords, documentId, readOnly = false }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}`

      const body: Partial<UpdateDocMetadataParams> = { readOnly }
      if (title) body.title = title
      if (description) body.description = description
      if (keywords) body.keywords = keywords

      // Send the Supabase token so the backend can owner-gate the readOnly lock
      // (same `token` header convention as fetchDocument/uploadMediaFile).
      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.token = session.access_token

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error('Failed to update document metadata')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['getDocumentMetadataByDocName'], data)
    }
  })

  return {
    isPending,
    isSuccess,
    mutate,
    data
  }
}

export default useUpdateDocMetadata
