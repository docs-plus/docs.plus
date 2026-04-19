import { useStore } from '@stores'
import { useEffect, useRef } from 'react'

const useEditableDocControl = () => {
  const deviceDetect = useStore((state) => state.settings.deviceDetect)
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const isEditable = useStore((state) => state.settings.editor.isEditable)
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

  // Reconcile the editor + DOM `contenteditable` attribute with the
  // store on the read-mode transition. Without this, the previous
  // effect updates only the store; the editor view stays editable and
  // the `<div class="tiptap ProseMirror" contenteditable="true">` node
  // lingers from the last edit session. iOS Safari then natively
  // focuses that contenteditable on the user's next tap inside it
  // (e.g. on a hyperlink) and runs its "scroll focused element into
  // view" routine — visible as the viewport jolting and the focus
  // being lost a moment later when our sheet handler blurs.
  //
  // Guards by design:
  // - Only acts on the false direction. Edit-mode entry is owned by
  //   call sites (useCaretPosition.enableEditor, AppendHeadingButton)
  //   that already flip all three of [DOM attr, store, editor]
  //   together. Re-applying setEditable(true) here would pre-empt the
  //   500ms grace period the legacy effect intentionally uses.
  // - Skips when the editor is already non-editable, so initial
  //   mount (store=false, editor mounts editable=true → settles via
  //   the 500ms effect) is left alone.
  useEffect(() => {
    if (!editor) return
    if (isEditable) return
    if (!editor.isEditable) return
    editor.setEditable(false)
    const dom = editor.view.dom as HTMLElement
    dom.setAttribute('contenteditable', 'false')
  }, [editor, isEditable])
}

export default useEditableDocControl
