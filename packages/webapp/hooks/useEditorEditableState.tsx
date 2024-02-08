import { useEffect } from 'react'
import { useAuthStore, useStore } from '@stores'

const useEditorEditableState = () => {
  const user = useAuthStore((state) => state.profile)
  const {
    metadata,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

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
