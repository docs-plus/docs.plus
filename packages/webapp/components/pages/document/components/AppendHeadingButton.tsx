import React, { useCallback } from 'react'
import ENUMS from '@components/TipTap/enums'
import { useModal } from '@components/ui/ModalDrawer'
import { useStore } from '@stores'
import { MdAdd } from 'react-icons/md'

const AppendHeadingButton = ({ className }: { className: string }) => {
  const {
    editor: { instance: editor, isMobile }
  } = useStore((state) => state.settings)

  const { close: closeModal } = isMobile ? useModal() || {} : {}

  const appendHeadingToEnd = useCallback(() => {
    if (!editor) return

    const emptyParagraphs = Array(5).fill({
      type: ENUMS.NODES.PARAGRAPH_TYPE
    })

    const jsonNode = {
      type: ENUMS.NODES.HEADING_TYPE,
      attrs: { level: 1 },
      content: [
        {
          type: ENUMS.NODES.CONTENT_HEADING_TYPE,
          attrs: { level: 1 }
        },
        {
          type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
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
    editor
      ?.chain()
      .focus(selectionPos + 2)
      .scrollIntoView()
      .run()
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
