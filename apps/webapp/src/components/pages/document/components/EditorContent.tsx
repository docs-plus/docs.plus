import SessionExpiredBanner from '@components/pages/document/components/SessionExpiredBanner'
import SyncErrorCard from '@components/pages/document/components/SyncErrorCard'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import { useMediaPasteUpload } from '@components/TipTap/mediaPopovers/useMediaPasteUpload'
import { useEditorFocusScroll, useEnableEditor } from '@hooks/useCaretPosition'
import useDoubleTap from '@hooks/useDoubleTap'
import { useStore } from '@stores'
import { EditorContent as TiptapEditor } from '@tiptap/react'
import { isSessionExpired, shouldShowSyncErrorWhileLoading } from '@utils/providerCollabStatus'
import { twMerge } from '@utils/twMerge'
import { useCallback, useRef, useState } from 'react'

const EditorContent = ({ className }: { className?: string }) => {
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const editorElement = useRef<HTMLDivElement>(null)
  const { enableAndFocus, isKeyboardOpen } = useEnableEditor()

  // No fade at the S0→S1 swap, where this mount drew the bones first. A mount after the
  // first sync (a return from history) fades once; the flag stops a replay on re-render.
  const [fadeIn, setFadeIn] = useState(() => !useStore.getState().settings.editor.providerSyncing)

  useMediaPasteUpload(editor)

  useEditorFocusScroll()

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
          fadeIn && 'motion-safe:animate-[doc-content-in_240ms_ease-out_both]',
          className
        )}
        editor={editor}
        onTouchEnd={handleDoubleTap}
        onAnimationEnd={(e) => {
          if (e.animationName === 'doc-content-in') setFadeIn(false)
        }}
      />
    </>
  )
}

export default EditorContent
