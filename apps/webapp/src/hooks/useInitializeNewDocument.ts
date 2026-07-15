import Config from '@config'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { Editor } from '@tiptap/react'
import { yUndoPluginKey } from '@tiptap/y-tiptap'
import { trackEvent } from '@utils/analytics'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

interface UseInitializeNewDocumentProps {
  editor: Editor | null
  provider: HocuspocusProvider
}

const useInitializeNewDocument = ({ editor, provider }: UseInitializeNewDocumentProps): void => {
  const {
    query: { slugs }
  } = useRouter()
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)

  useEffect(() => {
    // Pre-sync the ymetadata map is empty — a one-shot read here would miss the flag forever.
    if (!editor || !provider || providerSyncing) return

    const initializeDocument = () => {
      const ymetadata = provider.configuration.document.getMap('metadata')

      if (!ymetadata.get('needsInitialization')) return

      // A never-persisted draft meets a fresh server default state on every
      // reopen, whose needsInitialization=true can win the Y.Map merge over the
      // IndexedDB mirror's false — never setContent (it REPLACES) over user text.
      // Text, not node count: the editor pre-writes an empty heading scaffold.
      const fragmentText = provider.configuration.document
        .getXmlFragment('default')
        .toString()
        .replace(/<[^>]+>/g, '')
        .trim()
      if (fragmentText.length > 0) return

      const heading = Array.isArray(slugs) ? (slugs.at(0) ?? 'Title') : 'Title'
      const defaultContent = Config.editor.getDefaultContent(heading)

      // Seed outside undo history: the needsInitialization flip below lives in
      // Y.Map metadata (not undo scope), so undoing the seed would leave the
      // document permanently empty with no re-seed.
      editor.chain().setMeta('addToHistory', false).setContent(defaultContent).run()
      // Appended transactions (UniqueID id-stamping) reset ySync's addToHistory
      // before the batch syncs to Yjs, so the seed still lands on the undo
      // stack despite the meta — drop it outright.
      yUndoPluginKey.getState(editor.state)?.undoManager.clear()
      ymetadata.set('needsInitialization', false)
      // Only a genuinely new document carries needsInitialization, so this
      // fires once, on the creating client — not on every home-screen open.
      trackEvent('create_document')
    }

    initializeDocument()
  }, [editor, provider, slugs, providerSyncing])
}

export default useInitializeNewDocument
