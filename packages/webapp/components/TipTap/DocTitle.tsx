import { useEffect, useState } from 'react'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'
import { useStore } from '@stores'

const SSE_TITLE_ADDRESS = (docId: string) => `${process.env.NEXT_PUBLIC_SSE_URL}/${docId}_docTitle`

const broadcastTitle = async (documentId: string, newTitle: string) => {
  await fetch(SSE_TITLE_ADDRESS(documentId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: newTitle })
  })
}

const DocTitle = ({ className }: any) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState()
  const { hocuspocusProvider, metadata: docMetadata } = useStore((state) => state.settings)

  useEffect(() => {
    setTitle(docMetadata.title)
  }, [])

  useEffect(() => {
    const eventSource = new EventSource(SSE_TITLE_ADDRESS(docMetadata.documentId))

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.body.title) setTitle(data.title)
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const documentTitle = docMetadata.title || title

  const saveData = (e: any) => {
    if (e.target.innerText === documentTitle) return

    broadcastTitle(docMetadata.documentId, e.target.innerText)

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
      toast.success('Document title changed successfully')
    }
  }, [isSuccess])

  if (isLoading) return 'Loading...'

  return (
    <div className={`${className} `}>
      <div
        dangerouslySetInnerHTML={{ __html: title || '' }}
        contentEditable
        className="border border-transparent px-2 py-0 rounded-sm text-lg font-medium w-full hover:border-slate-300 truncate"
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
