import React from 'react'
import { useStore } from '@stores'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { Pencil } from '@icons'

const BigPencilBtn = () => {
  const {
    settings: {
      editor: { isMobile, instance: editor, selectionPos }
    }
  } = useStore((state) => state)
  const isKeyboardOpen = useDetectKeyboardOpen() || false

  const toggleToolbar = () => {
    if (!isMobile) return

    if (!isKeyboardOpen) {
      const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
      divProseMirror.setAttribute('contenteditable', 'true')
      useStore.getState().setWorkspaceEditorSetting('isEditable', true)
      editor?.setEditable(true)
    }

    editor
      ?.chain()
      .focus(selectionPos || 'start')
      .setTextSelection(selectionPos || 0)
      .scrollIntoView()
  }
  return (
    <div className="relative z-10">
      <button
        onClick={toggleToolbar}
        className={`btn_bigBluePencil btn btn-circle flex size-[68px] border-none bg-docsy shadow-md ${!isKeyboardOpen ? 'active block' : 'hidden'} fixed bottom-8 right-6 z-10`}>
        <Pencil size={32} />
      </button>
    </div>
  )
}

export default BigPencilBtn
