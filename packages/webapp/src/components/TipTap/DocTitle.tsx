import { Tooltip } from '@components/ui/Tooltip'
import { useStore } from '@stores'
import DOMPurify from 'dompurify'
import { useCallback, useEffect, useRef,useState } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { IoCheckmarkCircle } from 'react-icons/io5'
import { twMerge } from 'tailwind-merge'

import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'

const SAVED_INDICATOR_DURATION = 2000 // ms

const DocTitle = ({ className }: { className?: string }) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState<string | undefined>('')
  const [showSaved, setShowSaved] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { hocuspocusProvider, metadata: docMetadata } = useStore((state) => state.settings)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  // Initialize title from metadata
  useEffect(() => {
    if (docMetadata?.title) setTitle(docMetadata.title)
  }, [docMetadata?.title])

  const saveData = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const newTitle = e.target.innerText
      if (newTitle === title) return
      setTitle(newTitle)

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

  // Update title from hocuspocus provider, through stateless event (websocket)
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
  }, [hocuspocusProvider, docMetadata, setWorkspaceSetting])

  useEffect(() => {
    if (isSuccess && data) {
      // @ts-ignore
      setTitle(data.data.title)
      // @ts-ignore
      hocuspocusProvider.sendStateless(JSON.stringify({ type: 'docTitle', state: data.data }))

      // Clear any existing timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      // Show saved indicator and hide after duration
      setShowSaved(true)
      timeoutRef.current = setTimeout(() => {
        setShowSaved(false)
        timeoutRef.current = null
      }, SAVED_INDICATOR_DURATION)
    }
  }, [hocuspocusProvider, isSuccess, data, setTitle])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div className={twMerge(className, 'flex items-center gap-1')}>
      <Tooltip title="Rename" placement="bottom">
        <div
          dangerouslySetInnerHTML={{ __html: title || '' }}
          contentEditable
          className="truncate rounded-sm border border-transparent px-1 py-0 text-lg font-medium hover:border-slate-400"
          style={{ flex: 1 }}
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
      </Tooltip>
      <div
        className={`mx-2 flex size-4 items-center ${isLoading || showSaved ? 'flex' : 'hidden'}`}>
        <AiOutlineLoading3Quarters
          className={`${isLoading ? 'show' : 'hidden'} h-4 w-4 animate-spin text-blue-500`}
        />
        <IoCheckmarkCircle className={`${showSaved ? 'show' : 'hidden'} h-4 w-4 text-green-600`} />
      </div>
    </div>
  )
}

export default DocTitle
