import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

export interface UpdateDocMetadataParams {
  title?: string
  description?: string
  keywords?: string[]
  documentId: string
  readOnly?: boolean
  isPrivate?: boolean
}

export interface UpdateDocMetadataResponse {
  documentId: string
  readOnly: boolean
  isPrivate: boolean
  title?: string | null
  description?: string | null
  keywords?: string[] | string | null
}

const useUpdateDocMetadata = () => {
  const { isPending, isSuccess, mutate, data } = useMutation<
    UpdateDocMetadataResponse,
    Error,
    UpdateDocMetadataParams
  >({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: async ({ title, description, keywords, documentId, readOnly, isPrivate }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}`

      // Send only defined fields — a default readOnly=false would clobber an owner's lock.
      const body: Partial<UpdateDocMetadataParams> = {}
      if (title !== undefined) body.title = title
      if (description !== undefined) body.description = description
      if (keywords !== undefined) body.keywords = keywords
      if (readOnly !== undefined) body.readOnly = readOnly
      if (isPrivate !== undefined) body.isPrivate = isPrivate

      // Send the Supabase token so the backend can owner-gate the readOnly/isPrivate flags
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

      const json = await response.json()
      if (!json.success || !json.data) throw new Error('Invalid update response')
      return json.data as UpdateDocMetadataResponse
    },
    onSuccess: () => {
      // Documents list uses optimistic updates — do NOT invalidate here (avoids flash).
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
