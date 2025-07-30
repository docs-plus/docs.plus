import { EditorContent as TiptapEditor } from '@tiptap/react'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import { useStore } from '@stores'
import { twMerge } from 'tailwind-merge'
import { useRef, useCallback } from 'react'
import useDoubleTap from '@hooks/useDoubleTap'

const RenderLoader = ({ className }: { className?: string }) => {
  return (
    <div className={twMerge('ProseMirror tiptap__editor w-full', className)}>
      <DocumentSimpleLoader className="heading !h-auto" level="1" />
      <DocumentWithPictureLoader className="heading !h-auto" level="1" />
      <DocumentSimpleLoader className="heading !h-auto" level="1" />
    </div>
  )
}

const EditorContent = ({ className }: { className?: string }) => {
  const {
    editor: { instance: editor, loading, providerSyncing, applyingFilters }
  } = useStore((state) => state.settings)
  const { isKeyboardOpen } = useStore((state) => state)
  const editorElement = useRef<HTMLDivElement>(null)

  // Focus handler
  const handleFocus = useCallback(() => {
    if (!editor) return
    const btnBigBluePencil = document.querySelector('.btn_bigBluePencil') as HTMLButtonElement

    if (btnBigBluePencil && !isKeyboardOpen) btnBigBluePencil.click()
  }, [editor, isKeyboardOpen])

  // Double tap handler
  const handleDoubleTap = useDoubleTap(handleFocus)

  if (loading || providerSyncing || !editor) {
    return <RenderLoader className={className} />
  }

  return (
    <>
      <RenderLoader className={applyingFilters ? 'block' : 'hidden'} />
      <TiptapEditor
        inputMode={'text'}
        enterKeyHint={'enter'}
        autoFocus={isKeyboardOpen}
        ref={editorElement}
        className={twMerge(
          `tiptap__editor docy_editor relative w-full ${!applyingFilters ? 'block' : 'hidden'}`,
          className
        )}
        editor={editor}
        onTouchEnd={handleDoubleTap}
      />
    </>
  )
}

export default EditorContent
