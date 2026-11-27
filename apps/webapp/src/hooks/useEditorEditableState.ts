import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useAuthStore, useStore } from '@stores'
import { useEffect } from 'react'

// Module-scoped so the listener closure never captures a render's editor or provider (#782).
const syncScope = ({ scope }: { scope?: string }) => {
  useStore.getState().setWorkspaceSetting('authorizedScope', scope ?? null)
}

/**
 * Single editability apply path: mirror provider scope into the store so
 * `selectDocumentEditingLocked` reacts, then setEditable from that policy.
 */
const useEditorEditableState = () => {
  const user = useAuthStore((state) => state.profile)
  const editor = useStore((state) => state.settings.editor.instance)
  const provider = useStore((state) => state.settings.hocuspocusProvider)
  const locked = useStore((state) => selectDocumentEditingLocked(state.settings, user?.id))

  useEffect(() => {
    if (!provider) {
      useStore.getState().setWorkspaceSetting('authorizedScope', null)
      return
    }

    provider.on('authenticated', syncScope)
    syncScope({ scope: provider.authorizedScope })

    return () => {
      provider.off('authenticated', syncScope)
    }
  }, [provider])

  useEffect(() => {
    if (!editor) return
    // Only toggle on a real transition so providerStatus save-cycle flips don't
    // fire a redundant no-op 'update' emit on the collab editing hot path.
    if (editor.isEditable !== !locked) editor.setEditable(!locked)
  }, [editor, locked])
}

export default useEditorEditableState
