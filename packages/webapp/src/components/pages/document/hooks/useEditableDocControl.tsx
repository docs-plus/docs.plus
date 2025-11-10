import { useEffect } from 'react'
import { useStore } from '@stores'

const useEditableDocControl = () => {
  const {
    deviceDetect,
    editor: { instance: editor, loading }
  } = useStore((state) => state.settings)

  const { isKeyboardOpen } = useStore((state) => state)

  useEffect(() => {
    if (!editor) return
    // TODO: update text selection, when editable change to false, scrolling is getting hard when we have a text range selected
    const timeout = setTimeout(() => {
      if (isKeyboardOpen) return
      const divProseMirror = document.querySelector('.tiptap.ProseMirror')
      divProseMirror?.setAttribute('contenteditable', 'false')
      useStore.getState().setWorkspaceEditorSetting('isEditable', false)
      editor?.setEditable(false)
    }, 500)
    return () => {
      clearTimeout(timeout)
    }
  }, [deviceDetect, editor, isKeyboardOpen, loading])
}

export default useEditableDocControl
