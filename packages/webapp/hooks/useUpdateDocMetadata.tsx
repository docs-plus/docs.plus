import { useMutation, useQueryClient } from '@tanstack/react-query'

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

  const { isLoading, isSuccess, mutate, data } = useMutation<
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

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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
    isLoading,
    isSuccess,
    mutate,
    data
  }
}

export default useUpdateDocMetadata
