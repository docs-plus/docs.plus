import Link from 'next/link'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  DocsPlus
} from '../icons/Icons'

import OnlineIndicator from './OnlineIndicator'

const PadTitle = ({ docTitle, docId,docSlug, provider }) => {
  const queryClient = useQueryClient()

  const { isLoading, isSuccess, mutate } = useMutation({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: ({ title, docId }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${docId.split('.').at(-1)}`


      return fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      })
        .then(res => res.json())
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['getDocumentMetadataByDocName'], data)
    }
  })

  const saveData = (e) => {
    if (e.target.innerText === docTitle) return
    mutate({
      title: e.target.innerText,
      docId: docId.split('.').at(-1)
    })
  }


  return (
    <div className='flex flex-row items-center'>
      <div className='padLog'>
        <Link href="/">
          <DocsPlus size="34" />
        </Link>
      </div>
      <div className='ml-3'>
       {isLoading
         ? 'Loading...'
         : <div dangerouslySetInnerHTML={{ __html: docTitle }}
        contentEditable
         className="border border-transparent px-2 py-0 rounded-sm text-lg font-medium min-w-[14rem] hover:border-slate-300" type="text"
         onBlur={saveData}
         onKeyDown={(e) => {
           if (event.key === 'Enter') {
             e.preventDefault()
             e.target.blur()
           }
         }}
         >
        </div>}
      </div>
        <OnlineIndicator/>
    </div>
  )
}

export default PadTitle
