import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { useEffect } from 'react'

import { uploadMediaFile } from './uploadMediaFile'

interface EditorFileUploadEventDetail {
  files: File[]
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
      const { files, editor: eventEditor } = event.detail as EditorFileUploadEventDetail
      if (eventEditor !== editor || !files?.length || !docMetadata) return
      // Sequential: uploadMediaFile awaits image decoding before it places a
      // placeholder, so parallel uploads would insert in decode order.
      void (async () => {
        for (const file of files) await uploadMediaFile(editor, file, docMetadata)
      })()
    }

    document.addEventListener('editorFileUpload', handleEditorFileUpload)
    return () => document.removeEventListener('editorFileUpload', handleEditorFileUpload)
  }, [editor, docMetadata])
}
