import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { useStore } from '@stores'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'
import React from 'react'

const EditorContent = () => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const editor = useStore((state) => state.editor)

  if (loadingHistory || !editor) {
    return (
      <div className="editorWrapper scrollbar-custom scrollbar-thin bg-base-200 flex h-full grow items-start justify-center overflow-y-auto scroll-smooth border-t-0 px-3 py-4 sm:px-6 sm:py-6">
        <div className="ProseMirror tiptap__editor">
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
          <DocumentWithPictureLoader className="heading !h-auto" level="1" />
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
        </div>
      </div>
    )
  }

  return (
    <div className="editorWrapper scrollbar-custom scrollbar-thin bg-base-200 flex h-full grow items-start justify-center overflow-y-auto scroll-smooth border-t-0 px-3 py-4 sm:px-6 sm:py-6">
      <TiptapEditorContent
        editor={editor}
        className="tiptap__editor docy_editor mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8"
      />
    </div>
  )
}

export default EditorContent
