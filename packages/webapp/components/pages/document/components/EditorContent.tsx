import { EditorContent as TiptapEditor } from '@tiptap/react'
import DocumentWithPictureLoader from '@components/DocumentWithPictureLoader'
import DocumentSimpleLoader from '@components/DocumentSimpleLoader'
import { useStore } from '@stores'
import { twMerge } from 'tailwind-merge'
import { useEffect } from 'react'

const EditorContent = ({ className }: { className?: string }) => {
  const {
    editor: { instance: editor, loading, rendering }
  } = useStore((state) => state.settings)

  useEffect(() => {
    // TODO: this is temporary
    //@ts-ignore
    document.querySelector('.tiptap.ProseMirror')?.setAttribute('inputmode', 'text')
    //@ts-ignore
    document.querySelector('.tiptap.ProseMirror')?.setAttribute('enterkeyhint', 'enter')
  }, [editor])

  if (loading || rendering || !editor) {
    return (
      <div className={twMerge('ProseMirror tipta__editor', className)}>
        <DocumentSimpleLoader className="heading !h-auto" level="1" />
        <DocumentWithPictureLoader className="heading !h-auto" level="1" />
        <DocumentSimpleLoader className="heading !h-auto" level="1" />
      </div>
    )
  }
  return (
    <TiptapEditor
      inputMode="text"
      className={twMerge('tipta__editor', className)}
      editor={editor}
    />
  )
}

export default EditorContent
