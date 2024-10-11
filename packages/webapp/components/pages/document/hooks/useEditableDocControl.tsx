import { useEffect } from 'react'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { useStore } from '@stores'

const useEditableDocControl = () => {
  const {
    deviceDetect,
    editor: { instance: editor, loading }
  } = useStore((state) => state.settings)

  const isKeyboardOpen = useDetectKeyboardOpen() || false

  useEffect(() => {
    if (!editor) return

    setTimeout(() => {
      if (isKeyboardOpen) return
      const divProseMirror = document.querySelector('.tiptap.ProseMirror')
      divProseMirror?.setAttribute('contenteditable', 'false')
      useStore.getState().setWorkspaceEditorSetting('isEditable', false)
      editor?.setEditable(false)
    }, 500)
  }, [deviceDetect, editor, isKeyboardOpen, loading])
}

export default useEditableDocControl
