import { useEffect, useState } from 'react'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import { useStore } from '@stores'
// import { broadcastDocTitle } from '@api'
import * as toast from '@components/toast'

const DocTitle = ({ className }: any) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState()
  const { hocuspocusProvider, metadata: docMetadata } = useStore((state) => state.settings)

  useEffect(() => {
    setTitle(docMetadata.title)
  }, [docMetadata?.title])

  const saveData = (e: any) => {
    if (e.target.innerText === title) return

    // broadcastDocTitle(docMetadata.documentId, e.target.innerText)

    // @ts-ignore
    mutate({
      title: e.target.innerText,
      documentId: docMetadata.documentId
    })
  }

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }: any) => {
      const msg = JSON.parse(payload)
      if (msg.type === 'docTitle') setTitle(msg.state.title)
    }

    hocuspocusProvider.on('stateless', readOnlyStateHandler)

    return () => hocuspocusProvider.off('stateless', readOnlyStateHandler)
  }, [hocuspocusProvider])

  useEffect(() => {
    if (isSuccess && data) {
      setTitle(data.data.title)
      // broadcast to other clients
      hocuspocusProvider.sendStateless(JSON.stringify({ type: 'docTitle', state: data.data }))
      toast.Success('Document title changed successfully')
    }
  }, [isSuccess])

  if (isLoading) return 'Loading...'

  return (
    <div className={`${className} `}>
      <div
        dangerouslySetInnerHTML={{ __html: title || '' }}
        contentEditable
        className="w-full truncate rounded-sm border border-transparent px-2 py-0 text-lg font-medium hover:border-slate-300"
        onBlur={saveData}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}></div>
    </div>
  )
}

export default DocTitle
