import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { useStore } from '@stores'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'

const EditorContent = () => {
  const { loadingHistory, editor } = useStore((state) => state)

  if (loadingHistory || !editor) {
    return (
      <div className="editorWrapper flex h-full w-full grow items-start justify-center overflow-y-auto border-t-0">
        <div className={'ProseMirror tiptap__editor w-full'}>
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
          <DocumentWithPictureLoader className="heading !h-auto" level="1" />
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
        </div>
      </div>
    )
  }

  return (
    <div className="editor relative flex size-full w-full max-w-full flex-col justify-around align-top">
      <div className="editorWrapper flex h-full grow items-start justify-center overflow-hidden overflow-y-auto border-t-0 p-0">
        <TiptapEditorContent editor={editor} className="tiptap__editor relative" />
      </div>
    </div>
  )
}

export default EditorContent
