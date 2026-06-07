import Config from '@config'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Editor } from '@tiptap/react'
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

  useEffect(() => {
    if (!editor || !provider) return

    const initializeDocument = () => {
      const ymetadata = provider.configuration.document.getMap('metadata')

      if (!ymetadata.get('needsInitialization')) return

      const heading = Array.isArray(slugs) ? (slugs.at(0) ?? 'Title') : 'Title'
      const defaultContent = Config.editor.getDefaultContent(heading)

      editor.commands.setContent(defaultContent)
      ymetadata.set('needsInitialization', false)
    }

    initializeDocument()
  }, [editor, provider, slugs])
}

export default useInitializeNewDocument
