import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'

const scrollRootClass =
  'editor editorWrapper history-mobile-editor flex h-full min-h-0 w-full min-w-0 flex-1 border-t-0'

const EditorContent = () => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const editor = useStore((state) => state.editor)

  if (loadingHistory || !editor) {
    return (
      <ScrollArea className={scrollRootClass} scrollbarSize="thin">
        <div className="ProseMirror tiptap__editor docy_editor relative w-full">
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
          <DocumentWithPictureLoader className="heading !h-auto" level="1" />
          <DocumentSimpleLoader className="heading !h-auto" level="1" />
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className={scrollRootClass} scrollbarSize="thin">
      <TiptapEditorContent editor={editor} className="tiptap__editor docy_editor relative w-full" />
    </ScrollArea>
  )
}

export default EditorContent
