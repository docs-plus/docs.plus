import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { Editor, EditorEvents } from '@tiptap/react'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
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

    // The server discards every save while isDraft is set, and focus alone can
    // miss edits (programmatic inserts, drop). Any local-origin doc change is
    // edit intent — except the template seed, which dispatches while
    // needsInitialization is still true.
    const handleUpdate = ({ transaction }: EditorEvents['update']) => {
      if (
        transaction.docChanged &&
        !transaction.getMeta(ySyncPluginKey) &&
        !meta.get('needsInitialization') &&
        meta.get('isDraft')
      ) {
        meta.set('isDraft', false)
      }
    }

    editor.on('focus', handleFocus)
    editor.on('update', handleUpdate)
    return () => {
      editor.off('focus', handleFocus)
      editor.off('update', handleUpdate)
    }
  }, [editor, provider, documentId, providerSyncing])
}

export default useHandleDraftOnFocus
