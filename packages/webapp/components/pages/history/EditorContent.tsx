import React from 'react'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'
import { Editor } from '@tiptap/core'

interface EditorContentProps {
  isLoading: boolean
  editor: Editor | null
}

const EditorContent: React.FC<EditorContentProps> = ({ isLoading, editor }) => {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  return (
    <div className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4">
      <TiptapEditorContent
        editor={editor}
        className="tiptap__editor mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8"
      />
    </div>
  )
}

export default EditorContent
