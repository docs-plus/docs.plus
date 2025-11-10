import React from 'react'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'
import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { useStore } from '@stores'

const EditorContent = () => {
  const { loadingHistory, editor } = useStore((state) => state)

  if (loadingHistory || !editor) {
    return (
      <div className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-6">
        <div className="ProseMirror tiptap__editor">
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
          <DocumentWithPictureLoader className="heading !h-auto" level="1" />
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
        </div>
      </div>
    )
  }

  return (
    <div className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4">
      <TiptapEditorContent
        editor={editor}
        className="tiptap__editor docy_editor mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8"
      />
    </div>
  )
}

export default EditorContent
