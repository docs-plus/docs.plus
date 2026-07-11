import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useAuthStore, useStore } from '@stores'
import { useEffect } from 'react'

const useEditorEditableState = () => {
  const user = useAuthStore((state) => state.profile)
  const editor = useStore((state) => state.settings.editor.instance)
  // One editability policy, shared with every imperative enable path. The
  // selector reads primitives, so a collaborator's title rename (new metadata
  // object, same ownerId/readOnly) leaves `locked` unchanged and never re-runs.
  const locked = useStore((state) => selectDocumentEditingLocked(state.settings, user?.id))

  useEffect(() => {
    if (!editor) return
    // Only toggle on a real transition so providerStatus save-cycle flips don't
    // fire a redundant no-op 'update' emit on the collab editing hot path.
    if (editor.isEditable !== !locked) editor.setEditable(!locked)
  }, [editor, locked])
}

export default useEditorEditableState
