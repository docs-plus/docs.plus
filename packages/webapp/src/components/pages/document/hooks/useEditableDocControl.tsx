import { useStore } from '@stores'
import { useEffect } from 'react'

const useEditableDocControl = () => {
  const deviceDetect = useStore((state) => state.settings.deviceDetect)
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)

  useEffect(() => {
    if (!editor) return

    // TODO: update text selection, when editable change to false, scrolling is getting hard when we have a text range selected
    const timeout = setTimeout(() => {
      const { isKeyboardOpen } = useStore.getState()

      if (!isKeyboardOpen) {
        const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
        divProseMirror?.setAttribute('contenteditable', 'false')
        editor?.setEditable(false)
      } else {
        const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
        divProseMirror?.setAttribute('contenteditable', 'true')
        editor?.setEditable(true)
      }
    }, 500)
    return () => {
      clearTimeout(timeout)
    }
  }, [deviceDetect, editor, loading])

  useEffect(() => {
    setWorkspaceEditorSetting('isEditable', !isKeyboardOpen ? false : true)
  }, [isKeyboardOpen, setWorkspaceEditorSetting])
}

export default useEditableDocControl
