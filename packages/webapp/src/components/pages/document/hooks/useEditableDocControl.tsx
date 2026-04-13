import { useStore } from '@stores'
import { useEffect, useRef } from 'react'

const useEditableDocControl = () => {
  const deviceDetect = useStore((state) => state.settings.deviceDetect)
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)
  const prevKeyboardOpenRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (!editor) return

    // TODO: update text selection, when editable change to false, scrolling is getting hard when we have a text range selected
    const timeout = setTimeout(() => {
      const { isKeyboardOpen: kb, settings } = useStore.getState()
      const storeWantsEdit = settings.editor.isEditable

      if (!kb && !storeWantsEdit) {
        const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
        divProseMirror?.setAttribute('contenteditable', 'false')
        editor?.setEditable(false)
      } else if (kb || storeWantsEdit) {
        const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
        divProseMirror?.setAttribute('contenteditable', 'true')
        editor?.setEditable(true)
      }
    }, 500)
    return () => {
      clearTimeout(timeout)
    }
  }, [deviceDetect, editor, loading])

  // Never tie isEditable === isKeyboardOpen: iOS often opens the keyboard before visualViewport
  // fires `resize`, so FAB / focus can briefly have keyboard up while `isKeyboardOpen` is still false.
  // Only exit edit mode when the keyboard actually closes (transition true → false).
  useEffect(() => {
    const prev = prevKeyboardOpenRef.current
    if (prev === true && isKeyboardOpen === false) {
      setWorkspaceEditorSetting('isEditable', false)
    }
    prevKeyboardOpenRef.current = isKeyboardOpen
  }, [isKeyboardOpen, setWorkspaceEditorSetting])
}

export default useEditableDocControl
