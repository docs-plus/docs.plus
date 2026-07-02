import Config from '@config'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { Editor } from '@tiptap/react'
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

      const heading = Array.isArray(slugs) ? (slugs.at(0) ?? 'Title') : 'Title'
      const defaultContent = Config.editor.getDefaultContent(heading)

      editor.commands.setContent(defaultContent)
      ymetadata.set('needsInitialization', false)
      // Only a genuinely new document carries needsInitialization, so this
      // fires once, on the creating client — not on every home-screen open.
      trackEvent('create_document')
    }

    initializeDocument()
  }, [editor, provider, slugs, providerSyncing])
}

export default useInitializeNewDocument
