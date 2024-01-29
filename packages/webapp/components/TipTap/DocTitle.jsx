import { useEffect, useState } from 'react'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'
import { useDocumentMetadataContext } from '@context/DocumentMetadataContext'
import { useStore } from '@stores'

const SSE_TITLE_ADDRESS = (docId) => `${process.env.NEXT_PUBLIC_SSE_URL}/${docId}_docTitle`

const broadcastTitle = async (documentId, newTitle) => {
  await fetch(SSE_TITLE_ADDRESS(documentId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: newTitle })
  })
}

const DocTitle = ({ className }) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState()
  const docMetadata = useDocumentMetadataContext()
  const { hocuspocusProvider } = useStore((state) => state.settings)

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

  const saveData = (e) => {
    if (e.target.innerText === documentTitle) return

    broadcastTitle(docMetadata.documentId, e.target.innerText)

    mutate({
      title: e.target.innerText,
      documentId: docMetadata.documentId
    })
  }

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }) => {
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
        dangerouslySetInnerHTML={{ __html: title }}
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
    </div>
  )
}

export default DocTitle
