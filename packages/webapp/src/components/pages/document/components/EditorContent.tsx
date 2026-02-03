import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { useEditorFocusScroll, useEnableEditor } from '@hooks/useCaretPosition'
import useDoubleTap from '@hooks/useDoubleTap'
import { useStore } from '@stores'
import { EditorContent as TiptapEditor } from '@tiptap/react'
import { useCallback, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const editorElement = useRef<HTMLDivElement>(null)
  const { enableAndFocus, isKeyboardOpen } = useEnableEditor()

  // Auto-scroll caret into view on any focus (direct tap, etc.)
  useEditorFocusScroll()

  // Double-tap: enable editor and focus (caret already at tap position via iOS fix)
  const handleDoubleTap = useDoubleTap(
    useCallback(() => {
      if (!isKeyboardOpen) {
        enableAndFocus()
      }
    }, [isKeyboardOpen, enableAndFocus])
  )

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
