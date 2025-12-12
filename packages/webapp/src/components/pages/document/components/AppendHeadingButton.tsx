import React, { useCallback } from 'react'
import { TIPTAP_NODES } from '@types'
import { useModal } from '@components/ui/ModalDrawer'
import { useStore } from '@stores'
import { MdAdd } from 'react-icons/md'
import { scrollToHeading } from '@utils/scrollToHeading'

// Constants for timing and positioning
const SCROLL_DELAY_MS = 150
const FOCUS_DELAY_MS = 200
const CONTENT_POSITION_OFFSET = 2
const SEARCH_RANGE_BUFFER = 10

// Helper function to handle post-insertion actions
const handlePostInsertionActions = async (editor: any, selectionPos: number): Promise<void> => {
  try {
    await new Promise((resolve) => setTimeout(resolve, SCROLL_DELAY_MS))

    const { doc } = editor.state
    const insertPosition = selectionPos + CONTENT_POSITION_OFFSET
    const newHeadingId = findNewHeadingId(doc, insertPosition)

    if (newHeadingId) {
      scrollToHeading(newHeadingId)
      await new Promise((resolve) => setTimeout(resolve, FOCUS_DELAY_MS))
      editor?.commands.focus(insertPosition)
    }
  } catch (error) {
    console.error('Error handling post-insertion actions:', error)
  }
}

// Helper function to find the newly inserted heading
const findNewHeadingId = (doc: any, insertPosition: number): string | null => {
  let headingId: string | null = null
  const searchStart = Math.max(0, insertPosition - SEARCH_RANGE_BUFFER)
  const searchEnd = Math.min(doc.content.size, insertPosition + SEARCH_RANGE_BUFFER)

  doc.nodesBetween(searchStart, searchEnd, (node: any) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE && node.attrs?.id) {
      headingId = node.attrs.id
      return false // Stop iteration
    }
  })

  return headingId
}

const AppendHeadingButton = ({ className }: { className: string }) => {
  const {
    editor: { instance: editor, isMobile }
  } = useStore((state) => state.settings)

  const { close: closeModal } = isMobile ? useModal() || {} : {}

  const appendHeadingToEnd = useCallback(() => {
    if (!editor) return

    const emptyParagraphs = Array(5).fill({
      type: TIPTAP_NODES.PARAGRAPH_TYPE
    })

    const jsonNode = {
      type: TIPTAP_NODES.HEADING_TYPE,
      attrs: { level: 1 },
      content: [
        {
          type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
          attrs: { level: 1 }
        },
        {
          type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
          content: emptyParagraphs
        }
      ]
    }

    const selectionPos = editor.state.doc.content.size

    editor.commands.insertContentAt(selectionPos, jsonNode)
    isMobile && closeModal?.()

    const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
    divProseMirror.setAttribute('contenteditable', 'true')
    useStore.getState().setWorkspaceEditorSetting('isEditable', true)
    editor?.setEditable(true)

    // Handle post-insertion actions
    handlePostInsertionActions(editor, selectionPos)
  }, [editor, isMobile, closeModal])

  return (
    <div className={`p-3 ${className}`}>
      <button
        className="btn btn-sm btn-primary btn-outline btn-block tooltip"
        data-tip="Add headings"
        onClick={appendHeadingToEnd}>
        <MdAdd size={20} />
      </button>
    </div>
  )
}

export default AppendHeadingButton
