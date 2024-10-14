import { useEffect, useState, useCallback } from 'react'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import { useStore } from '@stores'
import * as toast from '@components/toast'
import DOMPurify from 'dompurify'

const DocTitle = ({ className }: { className: string }) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState<string | undefined>('')
  const { hocuspocusProvider, metadata: docMetadata } = useStore((state) => state.settings)

  useEffect(() => {
    if (docMetadata?.title) {
      setTitle(docMetadata.title)
    }
  }, [docMetadata?.title])

  const saveData = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const newTitle = e.target.innerText
      if (newTitle === title) return

      mutate({
        title: newTitle,
        documentId: docMetadata.documentId
      })
    },
    [title, mutate, docMetadata]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const sanitizedText = DOMPurify.sanitize(text)
    const selection = window.getSelection()

    if (selection?.rangeCount) {
      selection.deleteFromDocument()
      selection.getRangeAt(0).insertNode(document.createTextNode(sanitizedText))
      selection.collapseToEnd()
    }
  }, [])

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const sanitizedContent = DOMPurify.sanitize(e.currentTarget.innerHTML)
    e.currentTarget.innerHTML = sanitizedContent

    // Move cursor to the end of the content
    const range = document.createRange()
    const selection = window.getSelection()
    range.selectNodeContents(e.currentTarget)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [])

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }: any) => {
      const msg = JSON.parse(payload)
      if (msg.type === 'docTitle') {
        setTitle(msg.state.title)
      }
    }

    hocuspocusProvider.on('stateless', readOnlyStateHandler)

    return () => hocuspocusProvider.off('stateless', readOnlyStateHandler)
  }, [hocuspocusProvider])

  useEffect(() => {
    if (isSuccess && data) {
      // @ts-ignore
      setTitle(data.data.title)
      // @ts-ignore
      hocuspocusProvider.sendStateless(JSON.stringify({ type: 'docTitle', state: data.data }))
      toast.Success('Document title changed successfully')
    }
  }, [isSuccess, data, hocuspocusProvider])

  if (isLoading) return <div>Loading...</div>

  return (
    <div className={className}>
      <div
        dangerouslySetInnerHTML={{ __html: title || '' }}
        contentEditable
        className="w-full truncate rounded-sm border border-transparent px-2 py-0 text-lg font-medium hover:border-slate-300"
        onBlur={saveData}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        onPaste={handlePaste}
        onInput={handleInput}
      />
    </div>
  )
}

export default DocTitle
