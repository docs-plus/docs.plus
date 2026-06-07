import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { useEffect } from 'react'

import { uploadMediaFile } from './uploadMediaFile'

interface EditorFileUploadEventDetail {
  file: File
  editor: Editor
}

/**
 * Clipboard/file-upload bridge: the image paste plugin dispatches
 * `editorFileUpload` on `document`; this hook must live on the editor host.
 */
export function useMediaPasteUpload(editor: Editor | null | undefined): void {
  const docMetadata = useStore((state) => state.settings.metadata)

  useEffect(() => {
    if (!editor) return

    const handleEditorFileUpload = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const { file, editor: eventEditor } = event.detail as EditorFileUploadEventDetail
      if (eventEditor === editor && file && docMetadata) {
        void uploadMediaFile(editor, file, docMetadata)
      }
    }

    document.addEventListener('editorFileUpload', handleEditorFileUpload)
    return () => document.removeEventListener('editorFileUpload', handleEditorFileUpload)
  }, [editor, docMetadata])
}
