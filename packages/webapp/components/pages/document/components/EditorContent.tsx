import { EditorContent as TiptapEditor } from '@tiptap/react'
import DocumentWithPictureLoader from '@components/DocumentWithPictureLoader'
import DocumentSimpleLoader from '@components/DocumentSimpleLoader'
import { useStore } from '@stores'
import { twMerge } from 'tailwind-merge'
import { useEffect, useRef } from 'react'

const EditorContent = ({ className }: { className?: string }) => {
  const {
    editor: { instance: editor, loading, rendering }
  } = useStore((state) => state.settings)
  const editorElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const setAttributes = () => {
      const firstChild = editorElement.current?.firstChild as HTMLElement | null
      if (firstChild) {
        firstChild.setAttribute('inputmode', 'text')
        firstChild.setAttribute('enterkeyhint', 'enter')
      }
    }
    setAttributes()
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
      ref={editorElement}
      className={twMerge('tipta__editor', className)}
      editor={editor}
    />
  )
}

export default EditorContent
