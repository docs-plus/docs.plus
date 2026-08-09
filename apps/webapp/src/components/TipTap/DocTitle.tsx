import { Tooltip } from '@components/ui/Tooltip'
import { canEditDocumentMetadata } from '@hooks/canEditDocumentMetadata'
import { useAuthStore, useStore } from '@stores'
import DOMPurify from 'dompurify'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { IoCheckmarkCircle } from 'react-icons/io5'
import { twMerge } from 'tailwind-merge'

import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'

const SAVED_INDICATOR_DURATION = 2000 // ms

interface StatelessPayloadEvent {
  payload: string
}

interface DocTitleMessage {
  type: 'docTitle'
  state: {
    title: string
    [key: string]: unknown
  }
}

interface MetadataMutationResponse {
  title: string
  [key: string]: unknown
}

const extractMetadataMutationResponse = (response: unknown): MetadataMutationResponse => {
  if (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null
  ) {
    return response.data as MetadataMutationResponse
  }

  return response as MetadataMutationResponse
}

const DocTitle = ({ className }: { className?: string }) => {
  const { isPending, isSuccess, mutate, data } = useUpdateDocMetadata()
  const [title, setTitle] = useState<string | undefined>('')
  const [showSaved, setShowSaved] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const docMetadata = useStore((state) => state.settings.metadata)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const profileId = useAuthStore((state) => state.profile?.id)
  const canEdit = useStore((state) => canEditDocumentMetadata(state.settings, profileId))

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

    const range = selection.getRangeAt(0)

    const preCaretPosition = (() => {
      const tempRange = range.cloneRange()
      tempRange.selectNodeContents(currentTarget)
      tempRange.setEnd(range.startContainer, range.startOffset)
      return tempRange.toString().length
    })()

    const sanitizedContent = DOMPurify.sanitize(currentTarget.innerHTML)
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

    // If we can't find exact spot, place the caret at the end
    const fallbackRange = document.createRange()
    fallbackRange.selectNodeContents(currentTarget)
    fallbackRange.collapse(false)
    newSelection.addRange(fallbackRange)
  }, [])

  // Update title from hocuspocus provider, through stateless event (websocket)
  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }: StatelessPayloadEvent) => {
      const msg = JSON.parse(payload) as DocTitleMessage
      if (msg.type === 'docTitle') {
        setTitle(msg.state.title)
        setWorkspaceSetting('metadata', { ...docMetadata, title: msg.state.title })
      }
    }

    hocuspocusProvider.on('stateless', readOnlyStateHandler)

    return () => hocuspocusProvider.off('stateless', readOnlyStateHandler)
  }, [hocuspocusProvider, docMetadata, setWorkspaceSetting])

  useEffect(() => {
    if (isSuccess && data) {
      const updated = extractMetadataMutationResponse(data)
      setTitle(updated.title)
      hocuspocusProvider?.sendStateless(JSON.stringify({ type: 'docTitle', state: updated }))

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      setShowSaved(true)
      timeoutRef.current = setTimeout(() => {
        setShowSaved(false)
        timeoutRef.current = null
      }, SAVED_INDICATOR_DURATION)
    }
  }, [hocuspocusProvider, isSuccess, data, setTitle])

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
          dangerouslySetInnerHTML={{ __html: title || '' }}
          contentEditable={canEdit}
          className={twMerge(
            'truncate rounded-sm border border-transparent px-1 py-0 text-lg font-medium',
            canEdit && 'hover:border-base-300'
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
          onInput={handleInput}
        />
      </Tooltip>
      <div
        className={`mx-2 flex size-4 items-center ${isPending || showSaved ? 'flex' : 'hidden'}`}>
        <AiOutlineLoading3Quarters
          className={`${isPending ? 'show' : 'hidden'} text-info h-4 w-4 animate-spin`}
        />
        <IoCheckmarkCircle className={`${showSaved ? 'show' : 'hidden'} text-success h-4 w-4`} />
      </div>
    </div>
  )
}

export default DocTitle
