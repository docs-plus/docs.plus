import { useAuthStore, useStore } from '@stores'
import { useEffect } from 'react'

const useEditorEditableState = () => {
  const user = useAuthStore((state) => state.profile)
  const metadata = useStore((state) => state.settings.metadata)
  const editor = useStore((state) => state.settings.editor.instance)

  // update editable state
  // this runs when the document is opened
  useEffect(() => {
    if (!editor) return
    // make sure the owner can always edit the document
    if (metadata?.ownerId === user?.id) return editor.setEditable(true)
    // make sure the owner can always edit the document
    editor.setEditable(!metadata?.readOnly)
  }, [editor, metadata])
}

export default useEditorEditableState
