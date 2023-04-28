import { EditorContent } from '@tiptap/react'
import DocumentWithPuctureLoader from '../../../components/DocumentWithPictureLoader'
import DocumentSimpleLoader from '../../../components/DocumentSimpleLoader'
import { useEditorStateContext } from '../../../context/EditorContext'

const Editor = ({ editor }) => {
  const {
    loading,
    applyingFilters,
  } = useEditorStateContext()

  if (loading || applyingFilters || !editor) {
    return (
      <div
        className={`ProseMirror tipta__editor loading mb-12 border-t-0 pt-8 sm:mb-0 sm:p-8 px-6 `}
      >
        <DocumentSimpleLoader className="!h-auto heading !border-t-0" level="1" />
        <DocumentWithPuctureLoader className="!h-auto heading" level="1" />
        <DocumentSimpleLoader className="!h-auto heading" level="1" />
      </div>
    )
  }

  return <EditorContent className={`tipta__editor mb-12 sm:mb-0 sm:p-8`} editor={editor} />
}

export default Editor;
