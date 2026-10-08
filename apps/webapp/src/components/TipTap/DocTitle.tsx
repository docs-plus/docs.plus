import { Tooltip } from '@components/ui/Tooltip'
import { canEditDocumentMetadata } from '@hooks/canEditDocumentMetadata'
import { useAuthStore, useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import DOMPurify from 'dompurify'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IoCheckmarkCircle } from 'react-icons/io5'

import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import { plainTitle } from '../../utils/titleWrite'

const SAVED_INDICATOR_DURATION = 2000 // ms

const DocTitle = ({ className }: { className?: string }) => {
  const { isPending, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState<string | undefined>('')
  const [showSaved, setShowSaved] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const docMetadata = useStore((state) => state.settings.metadata)
  const profileId = useAuthStore((state) => state.profile?.id ?? state.session?.id)
  const canEdit = useStore((state) => canEditDocumentMetadata(state.settings, profileId))

  useEffect(() => {
    if (docMetadata?.title) setTitle(plainTitle(docMetadata.title))
  }, [docMetadata?.title])

  const saveData = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const newTitle = plainTitle(e.target.innerText)
      if (newTitle === title) return
      setTitle(newTitle)

      mutate({
        title: newTitle,
        documentId: docMetadata.documentId,
        // The normalized URL slug (never slugify(newTitle)) so a title-first
        // draft anchors under the slug reload resolves by. See useUpdateDocMetadata.
        slug: docMetadata.slug
      })
    },
    [title, mutate, docMetadata]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const sanitizedText = plainTitle(text)
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

    const range = selection.getRangeAt(0)

    const preCaretPosition = (() => {
      const tempRange = range.cloneRange()
      tempRange.selectNodeContents(currentTarget)
      tempRange.setEnd(range.startContainer, range.startOffset)
      return tempRange.toString().length
    })()

    const sanitizedContent = DOMPurify.sanitize(currentTarget.innerHTML, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    })
    currentTarget.innerHTML = sanitizedContent

    const newSelection = window.getSelection()
    if (!newSelection) return
    newSelection.removeAllRanges()

    // Sanitizing replaces the text nodes, so walk them to re-seat the caret.
    const walker = document.createTreeWalker(currentTarget, NodeFilter.SHOW_TEXT, null)
    let charCount = 0

    while (walker.nextNode()) {
      const currentNode = walker.currentNode
      const nodeLength = currentNode.nodeValue?.length || 0

      if (charCount + nodeLength >= preCaretPosition) {
        const offset = preCaretPosition - charCount
        const newRange = document.createRange()
        newRange.setStart(currentNode, offset)
        newRange.collapse(true)
        newSelection.addRange(newRange)
        return
      }

      charCount += nodeLength
    }

    const fallbackRange = document.createRange()
    fallbackRange.selectNodeContents(currentTarget)
    fallbackRange.collapse(false)
    newSelection.addRange(fallbackRange)
  }, [])

  useEffect(() => {
    if (isSuccess && data) {
      const next = plainTitle(data.title ?? '')
      setTitle(next)

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      setShowSaved(true)
      timeoutRef.current = setTimeout(() => {
        setShowSaved(false)
        timeoutRef.current = null
      }, SAVED_INDICATOR_DURATION)
    }
  }, [isSuccess, data, setTitle])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div className={twMerge(className, 'flex items-center gap-1')}>
      <Tooltip
        title={canEdit ? 'Rename' : 'Only the owner can rename this document'}
        placement="bottom">
        <div
          contentEditable={canEdit}
          suppressContentEditableWarning
          className={twMerge(
            'rounded-field truncate border border-transparent px-1 py-0 text-lg font-medium',
            canEdit && 'hover:border-base-300 cursor-text'
          )}
          style={{ flex: 1 }}
          onBlur={saveData}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          onPaste={handlePaste}
          onInput={handleInput}>
          {title || ''}
        </div>
      </Tooltip>
      <div
        className={`mx-2 flex size-4 items-center ${isPending || showSaved ? 'flex' : 'hidden'}`}>
        {/* Status, not interaction: the spinner inherits the title ink. */}
        <span
          aria-hidden
          className={`${isPending ? 'inline-block' : 'hidden'} loading loading-spinner loading-xs`}
        />
        <IoCheckmarkCircle className={`${showSaved ? 'show' : 'hidden'} text-success h-4 w-4`} />
      </div>
    </div>
  )
}

export default DocTitle
