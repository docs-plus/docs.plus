import { useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'

interface UseHandleDraftOnFocusProps {
  editor: Editor | null
  provider: HocuspocusProvider
}

const useHandleDraftOnFocus = ({ editor, provider }: UseHandleDraftOnFocusProps): void => {
  const {
    metadata: { documentId }
  } = useStore((state) => state.settings)

  // handle focus event to set the document to not draft
  useEffect(() => {
    if (!editor || !provider) return

    const meta = provider.configuration.document.getMap('metadata')
    const isADraftDocument = meta.get('isDraft')

    if (isADraftDocument) return

    editor.on('focus', () => {
      const isDraft = meta.get('isDraft')
      if (isDraft) {
        meta.set('isDraft', false)
      }
    })
  }, [editor, provider, documentId])
}

export default useHandleDraftOnFocus
