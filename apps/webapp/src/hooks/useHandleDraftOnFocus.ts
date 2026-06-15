import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { Editor } from '@tiptap/react'
import { useEffect } from 'react'

interface UseHandleDraftOnFocusProps {
  editor: Editor | null
  provider: HocuspocusProvider
}

const useHandleDraftOnFocus = ({ editor, provider }: UseHandleDraftOnFocusProps): void => {
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)

  useEffect(() => {
    // Pre-sync the ymetadata map is empty — a one-shot `isDraft` read would miss the flag forever.
    if (!editor || !provider || providerSyncing) return

    const meta = provider.configuration.document.getMap('metadata')
    if (!meta.get('isDraft')) return

    const handleFocus = () => {
      if (meta.get('isDraft')) {
        meta.set('isDraft', false)
      }
    }

    editor.on('focus', handleFocus)
    return () => {
      editor.off('focus', handleFocus)
    }
  }, [editor, provider, documentId, providerSyncing])
}

export default useHandleDraftOnFocus
