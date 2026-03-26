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

  useEffect(() => {
    if (!editor || !provider) return

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
  }, [editor, provider, documentId])
}

export default useHandleDraftOnFocus
