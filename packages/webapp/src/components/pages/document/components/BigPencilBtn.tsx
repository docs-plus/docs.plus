import React, { useCallback } from 'react'
import { useStore } from '@stores'
import { Pencil } from '@icons'

const BigPencilBtn = () => {
  const { settings, isKeyboardOpen } = useStore()
  const { instance: editor, selectionPos } = settings.editor

  const handleClick = useCallback(() => {
    // Enable editor if keyboard not open
    if (!isKeyboardOpen) {
      const proseMirrorEl = document.querySelector('.tiptap.ProseMirror') as HTMLElement
      proseMirrorEl?.setAttribute('contenteditable', 'true')
      useStore.getState().setWorkspaceEditorSetting('isEditable', true)
      editor?.setEditable(true)
    }

    // Focus and scroll immediately
    editor
      ?.chain()
      .setTextSelection(selectionPos || 0)
      .focus(selectionPos || 'start')
      .scrollIntoView()
  }, [isKeyboardOpen, editor, selectionPos])

  if (isKeyboardOpen) return null

  return (
    <div className="relative z-10">
      <button
        onClick={handleClick}
        className="btn_bigBluePencil btn btn-circle border-docsy bg-docsy active fixed right-6 bottom-8 z-10 block flex size-[68px]">
        <Pencil size={32} />
      </button>
    </div>
  )
}

export default BigPencilBtn
