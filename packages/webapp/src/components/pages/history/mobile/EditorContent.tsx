import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { useStore } from '@stores'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'

const EditorContent = () => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const editor = useStore((state) => state.editor)

  if (loadingHistory || !editor) {
    return (
      <div className="editorWrapper flex h-full min-h-0 w-full flex-1 items-start justify-center overflow-y-auto border-t-0">
        <div className={'ProseMirror tiptap__editor w-full'}>
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
          <DocumentWithPictureLoader className="heading !h-auto" level="1" />
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
        </div>
      </div>
    )
  }

  return (
    <div className="editor relative flex size-full min-h-0 w-full max-w-full flex-col justify-around align-top">
      <div className="editorWrapper flex min-h-0 flex-1 items-start justify-center overflow-y-auto border-t-0 p-0">
        <TiptapEditorContent editor={editor} className="tiptap__editor relative" />
      </div>
    </div>
  )
}

export default EditorContent
