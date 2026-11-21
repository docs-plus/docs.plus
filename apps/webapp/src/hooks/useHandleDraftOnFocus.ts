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

    // No early return on a false isDraft: a server restart before the first save
    // serves its default state again, which can flip isDraft back to true (#799).
    const meta = provider.configuration.document.getMap('metadata')

    const handleFocus = () => {
      if (meta.get('isDraft')) {
        meta.set('isDraft', false)
      }
    }

    // The server drops every save while isDraft is set, and focus can miss edits
    // (programmatic inserts, drop). A local change is edit intent, except the
    // template seed: it runs on an empty pad while needsInitialization is true.
    // A restart can set that flag again over the user's text (#799): a focused edit to text wins.
    const handleUpdate = ({ transaction }: EditorEvents['update']) => {
      const typedOverText = editor.isFocused && transaction.before.textContent.trim().length > 0
      if (
        transaction.docChanged &&
        !transaction.getMeta(ySyncPluginKey) &&
        (!meta.get('needsInitialization') || typedOverText) &&
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
