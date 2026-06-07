import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'
import React from 'react'

const EditorContent = () => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const editor = useStore((state) => state.editor)

  if (loadingHistory || !editor) {
    return (
      <ScrollArea
        className="editorWrapper bg-base-200 flex min-h-0 min-w-0 flex-1 items-start justify-center border-t-0 px-3 py-4 sm:px-6 sm:py-6"
        scrollbarSize="thin">
        <div className="ProseMirror tiptap__editor">
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
          <DocumentWithPictureLoader className="heading !h-auto" level="1" />
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea
      className="editorWrapper bg-base-200 flex min-h-0 min-w-0 flex-1 items-start justify-center border-t-0 px-3 py-4 sm:px-6 sm:py-6"
      scrollbarSize="thin">
      <TiptapEditorContent
        editor={editor}
        className="tiptap__editor docy_editor mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8"
      />
    </ScrollArea>
  )
}

export default EditorContent
