import React, { useCallback } from 'react'
import { FaPlus } from 'react-icons/fa6'
import ENUMS from '@components/TipTap/enums'
import { useModal } from '@components/ui/ModalDrawer'
import { useStore } from '@stores'
import { MdAdd } from 'react-icons/md'

const AppendHeadingButton = ({ className }: { className: string }) => {
  const { close: closeModal } = useModal() || {}
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const appendHeadingToEnd = useCallback(() => {
    if (!editor) return

    const emptyParagraphs = Array(16).fill({
      type: ENUMS.NODES.PARAGRAPH_TYPE,
      content: [{ type: ENUMS.NODES.TEXT_TYPE, text: '\u00A0' }]
    })

    const jsonNode = {
      type: ENUMS.NODES.HEADING_TYPE,
      attrs: { level: 1 },
      content: [
        {
          type: ENUMS.NODES.CONTENT_HEADING_TYPE,
          content: [{ type: ENUMS.NODES.TEXT_TYPE, text: '\u00A0' }],
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
    closeModal?.()

    // make the editor editable
    const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
    divProseMirror.setAttribute('contenteditable', 'true')
    useStore.getState().setWorkspaceEditorSetting('isEditable', true)
    editor?.setEditable(true)
    editor
      ?.chain()
      .focus(selectionPos + 2) // focus on content wrapper not heading
      .scrollIntoView()
      .run()
  }, [editor])

  return (
    <div className={`p-3 ${className}`}>
      <button className="btn btn-sm btn-primary btn-outline btn-block" onClick={appendHeadingToEnd}>
        <MdAdd size={20} />
        <span className="">Add headings</span>
      </button>
    </div>
  )
}

export default AppendHeadingButton
