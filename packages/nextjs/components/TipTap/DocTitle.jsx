import { useMutation, useQueryClient } from '@tanstack/react-query'

const DocTitle = ({ docTitle, docId, docSlug, provider, className }) => {
  const queryClient = useQueryClient()

  const { isLoading, isSuccess, mutate } = useMutation({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: ({ title, docId }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      docId = docId.split('.').at(-1)
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${docId}`

      return fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      }).then((res) => res.json())
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['getDocumentMetadataByDocName'], data)
    },
  })

  const saveData = (e) => {
    if (e.target.innerText === docTitle) return
    mutate({
      title: e.target.innerText,
      docId: docId.split('.').at(-1),
    })
  }

  return (
    <div className={`${className} `}>
      {isLoading ? (
        'Loading...'
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: docTitle }}
          contentEditable
          className="border border-transparent px-2 py-0 rounded-sm text-lg font-medium w-full hover:border-slate-300 truncate"
          type="text"
          onBlur={saveData}
          onKeyDown={(e) => {
            if (event.key === 'Enter') {
              e.preventDefault()
              e.target.blur()
            }
          }}></div>
      )}
    </div>
  )
}

export default DocTitle
