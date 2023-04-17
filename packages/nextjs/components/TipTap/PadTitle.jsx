import Link from 'next/link'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  DocsPlus,
  Hamburger
} from '../icons/Icons'

import OnlineIndicator from './OnlineIndicator'

const PadTitle = ({ docTitle, docId, docSlug, provider }) => {
  const queryClient = useQueryClient()

  const { isLoading, isSuccess, mutate } = useMutation({
    mutationKey: ['updateDocumentMetadata'],
    mutationFn: ({ title, docId }) => {
      // NOTE: This is a hack to get the correct URL in the build time
      const url = `${ process.env.NEXT_PUBLIC_RESTAPI_URL }/documents/${ docId.split('.').at(-1) }`


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
    <div className='flex flex-row items-center w-full sm:w-auto justify-center sm:justify-normal'>
      <div className='padLog hidden sm:block'>
        <Link href="/">
          <DocsPlus size="34" />
        </Link>
      </div>
      <div className='sm:hidden'>
        <button className="w-10 h-10 flex align-middle justify-center items-center " type="button">
          <Hamburger size="30" />
        </button>
      </div>
      <div className='sm:ml-3 ml-2 '>
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
      <div className='w-10 h-10 border rounded-full bg-gray-400 ml-auto sm:hidden'></div>
      <OnlineIndicator className="hidden sm:block " />
    </div>
  )
}

export default PadTitle
