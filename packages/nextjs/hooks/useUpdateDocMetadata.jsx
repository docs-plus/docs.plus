import { useMutation, useQueryClient } from '@tanstack/react-query'

const useUpdateDocMetadata = () => {
  const queryClient = useQueryClient()

  const { isLoading, isSuccess, mutate } = useMutation({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: ({ title, description, keywords, docId }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${docId.split('.').at(-1)}`

      const body = {}
      if (title) body.title = title
      if (description) body.description = description
      if (keywords) body.keywords = keywords

      return fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }).then((res) => res.json())
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['getDocumentMetadataByDocName'], data)
    }
  })

  return {
    isLoading,
    isSuccess,
    mutate
  }
}

export default useUpdateDocMetadata
