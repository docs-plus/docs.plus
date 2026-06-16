import editorConfig from '@components/TipTap/TipTap'
import { useStore } from '@stores'
import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'

import { clearHistorySession } from '../clearHistorySession'
import { useHocuspocusStateless } from './useHocuspocusStateless'

export function useHistoryEditor() {
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const setEditor = useStore((state) => state.setEditor)

  const editor = useEditor(editorConfig({ editable: false }), [documentId])

  useEffect(() => {
    if (editor) setEditor(editor)
    return () => setEditor(null)
  }, [editor, setEditor])

  useEffect(() => () => clearHistorySession(), [])

  useHocuspocusStateless()

  return editor
}
