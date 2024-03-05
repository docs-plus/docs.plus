import { EditorContent as TiptapEditor } from '@tiptap/react'
import DocumentWithPictureLoader from '@components/DocumentWithPictureLoader'
import DocumentSimpleLoader from '@components/DocumentSimpleLoader'
import { useStore } from '@stores'

const EditorContent = () => {
  const {
    editor: { instance: editor, loading, rendering }
  } = useStore((state) => state.settings)

  if (loading || rendering || !editor) {
    return (
      <div className={`ProseMirror tipta__editor mb-12 border-t-0 pt-8 sm:mb-0 sm:p-8 px-6 `}>
        <DocumentSimpleLoader className="!h-auto heading" level="1" />
        <DocumentWithPictureLoader className="!h-auto heading" level="1" />
        <DocumentSimpleLoader className="!h-auto heading" level="1" />
      </div>
    )
  }

  return <TiptapEditor className={`tipta__editor mb-12 sm:mb-0 sm:p-3`} editor={editor} />
}

export default EditorContent
