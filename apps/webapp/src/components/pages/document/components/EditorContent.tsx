import SessionExpiredBanner from '@components/pages/document/components/SessionExpiredBanner'
import SyncErrorCard from '@components/pages/document/components/SyncErrorCard'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import { useMediaPasteUpload } from '@components/TipTap/mediaPopovers/useMediaPasteUpload'
import { useEditorFocusScroll, useEnableEditor } from '@hooks/useCaretPosition'
import useDoubleTap from '@hooks/useDoubleTap'
import { useStore } from '@stores'
import { EditorContent as TiptapEditor } from '@tiptap/react'
import { isSessionExpired, shouldShowSyncErrorWhileLoading } from '@utils/providerCollabStatus'
import { useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const EditorContent = ({ className }: { className?: string }) => {
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const editorElement = useRef<HTMLDivElement>(null)
  const { enableAndFocus, isKeyboardOpen } = useEnableEditor()

  // Entry fade plays once on mount; the flag keeps it from replaying on re-render.
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

  const needsAuth = isSessionExpired(providerStatus)

  if (providerSyncing && shouldShowSyncErrorWhileLoading(providerStatus)) {
    return (
      <SyncErrorCard
        offline={providerStatus === 'offline'}
        needsAuth={needsAuth}
        className={className}
      />
    )
  }

  if (loading || providerSyncing || !editor) {
    return <EditorContentSkeleton className={className} />
  }

  return (
    <>
      {needsAuth && <SessionExpiredBanner />}
      <TiptapEditor
        inputMode={'text'}
        enterKeyHint={'enter'}
        autoFocus={isKeyboardOpen}
        ref={editorElement}
        className={twMerge(
          'tiptap__editor docy_editor relative w-full',
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
