import { useEffect, useState, useCallback } from 'react'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import { useStore } from '@stores'
import * as toast from '@components/toast'
import DOMPurify from 'dompurify'

const DocTitle = ({ className }: { className?: string }) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState<string | undefined>('')
  const { hocuspocusProvider, metadata: docMetadata } = useStore((state) => state.settings)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

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
    const { currentTarget } = e
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    // Save current selection range
    const range = selection.getRangeAt(0)

    // Calculate current caret position by counting text length before the caret
    const preCaretPosition = (() => {
      const tempRange = range.cloneRange()
      tempRange.selectNodeContents(currentTarget)
      tempRange.setEnd(range.startContainer, range.startOffset)
      return tempRange.toString().length
    })()

    // Sanitize content
    const sanitizedContent = DOMPurify.sanitize(currentTarget.innerHTML)
    currentTarget.innerHTML = sanitizedContent

    // Restore selection
    const newSelection = window.getSelection()
    if (!newSelection) return
    newSelection.removeAllRanges()

    // Use a TreeWalker to find the correct position for the caret
    const walker = document.createTreeWalker(currentTarget, NodeFilter.SHOW_TEXT, null)
    let node: Node | null = null
    let charCount = 0

    while (walker.nextNode()) {
      const currentNode = walker.currentNode
      const nodeLength = currentNode.nodeValue?.length || 0

      if (charCount + nodeLength >= preCaretPosition) {
        node = currentNode
        const offset = preCaretPosition - charCount
        const newRange = document.createRange()
        // @ts-ignore
        newRange.setStart(node, offset)
        newRange.collapse(true)
        newSelection.addRange(newRange)
        return
      }

      charCount += nodeLength
    }

    // If we can't find exact spot, place the caret at the end
    const fallbackRange = document.createRange()
    fallbackRange.selectNodeContents(currentTarget)
    fallbackRange.collapse(false)
    newSelection.addRange(fallbackRange)
  }, [])

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }: any) => {
      const msg = JSON.parse(payload)
      if (msg.type === 'docTitle') {
        setTitle(msg.state.title)
        // also update the docMetadata in the store
        setWorkspaceSetting('metadata', { ...docMetadata, title: msg.state.title })
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
  }, [hocuspocusProvider, isSuccess, data])

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
