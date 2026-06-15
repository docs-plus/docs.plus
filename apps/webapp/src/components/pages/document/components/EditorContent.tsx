import SyncErrorCard from '@components/pages/document/components/SyncErrorCard'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import { useMediaPasteUpload } from '@components/TipTap/mediaPopovers/useMediaPasteUpload'
import { useEditorFocusScroll, useEnableEditor } from '@hooks/useCaretPosition'
import useDoubleTap from '@hooks/useDoubleTap'
import { useStore } from '@stores'
import { EditorContent as TiptapEditor } from '@tiptap/react'
import { useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const EditorContent = ({ className }: { className?: string }) => {
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const applyingFilters = useStore((state) => state.settings.editor.applyingFilters)
  const editorElement = useRef<HTMLDivElement>(null)
  const { enableAndFocus, isKeyboardOpen } = useEnableEditor()

  // Entry fade plays once; the class must come off afterwards or the
  // applyingFilters display toggle (hidden→block) restarts it.
  const [entryFadeDone, setEntryFadeDone] = useState(false)

  // Clipboard/file uploads dispatched by the image extension's paste plugin.
  useMediaPasteUpload(editor)

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

  if (providerSyncing && (providerStatus === 'error' || providerStatus === 'offline')) {
    return <SyncErrorCard offline={providerStatus === 'offline'} className={className} />
  }

  if (loading || providerSyncing || !editor) {
    return <EditorContentSkeleton className={className} />
  }

  return (
    <>
      <EditorContentSkeleton className={applyingFilters ? 'block' : 'hidden'} />
      <TiptapEditor
        inputMode={'text'}
        enterKeyHint={'enter'}
        autoFocus={isKeyboardOpen}
        ref={editorElement}
        className={twMerge(
          `tiptap__editor docy_editor relative w-full ${!applyingFilters ? 'block' : 'hidden'}`,
          !entryFadeDone && 'motion-safe:animate-[doc-content-in_240ms_ease-out_both]',
          className
        )}
        editor={editor}
        onTouchEnd={handleDoubleTap}
        onAnimationEnd={(e) => {
          if (e.animationName === 'doc-content-in') setEntryFadeDone(true)
        }}
      />
    </>
  )
}

export default EditorContent
