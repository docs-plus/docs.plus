import { useStore } from '@stores'
import { useEffect } from 'react'

const useEditorReadOnly = () => {
  const provider = useStore((state) => state.settings.hocuspocusProvider)
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!provider || !editor) return

    // Only ever forces editable OFF: onAuthenticate never sets connection
    // readOnly for owners (hocuspocus.server.ts), so this cannot fight the
    // owner path in useEditorEditableState.
    const applyScope = (scope?: string) => {
      if (scope === 'readonly') editor.setEditable(false)
    }

    const authenticatedHandler = ({ scope }: { scope: string }) => applyScope(scope)

    provider.on('authenticated', authenticatedHandler)
    // The editor mounts after first sync, so 'authenticated' has usually
    // already fired — apply the current scope immediately.
    applyScope(provider.authorizedScope)

    return () => {
      provider.off('authenticated', authenticatedHandler)
    }
  }, [provider, editor])
}

export default useEditorReadOnly
