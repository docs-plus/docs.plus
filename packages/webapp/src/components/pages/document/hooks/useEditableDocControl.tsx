import { useEffect } from 'react'
import { useStore } from '@stores'

const useEditableDocControl = () => {
  const {
    deviceDetect,
    editor: { instance: editor, loading }
  } = useStore((state) => state.settings)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  useEffect(() => {
    if (!editor) return
      const isKeyboardOpen = useStore.getState().isKeyboardOpen

    // TODO: update text selection, when editable change to false, scrolling is getting hard when we have a text range selected
    const timeout = setTimeout(() => {

      if (isKeyboardOpen) {
        const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
        divProseMirror?.setAttribute('contenteditable', 'false')
        useStore.getState().setWorkspaceEditorSetting('isEditable', false)
        editor?.setEditable(false)
      } else {
        const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
        divProseMirror?.setAttribute('contenteditable', 'true')
        setWorkspaceEditorSetting('isEditable', true)
        editor?.setEditable(true)
      }

    }, 500)
    return () => {
      clearTimeout(timeout)
    }
  }, [deviceDetect, editor, loading])
}

export default useEditableDocControl
