import SessionExpiredBanner from '@components/pages/document/components/SessionExpiredBanner'
import SyncErrorCard from '@components/pages/document/components/SyncErrorCard'
import { useFadeAfterFirstSync } from '@components/pages/document/hooks/useFadeAfterFirstSync'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import { useMediaPasteUpload } from '@components/TipTap/mediaPopovers/useMediaPasteUpload'
import { useEditorFocusScroll, useEnableEditor } from '@hooks/useCaretPosition'
import useDoubleTap from '@hooks/useDoubleTap'
import { useStore } from '@stores'
import { EditorContent as TiptapEditor } from '@tiptap/react'
import { isSessionExpired, shouldShowSyncErrorWhileLoading } from '@utils/providerCollabStatus'
import { twMerge } from '@utils/twMerge'
import { useCallback, useRef } from 'react'

const EditorContent = ({ className }: { className?: string }) => {
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const editorElement = useRef<HTMLDivElement>(null)
  const { enableAndFocus, isKeyboardOpen } = useEnableEditor()

  // Cleared when the fade ends, so a re-render does not replay it.
  const [fadeIn, setFadeIn] = useFadeAfterFirstSync()

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

  const cover =
    providerSyncing && shouldShowSyncErrorWhileLoading(providerStatus) ? (
      <SyncErrorCard
        offline={providerStatus === 'offline'}
        needsAuth={needsAuth}
        className={className}
      />
    ) : (
      <EditorContentSkeleton className={className} />
    )

  if (loading || !editor) return cover

  // Mount the editor hidden before first sync. Mounting it later re-runs createNodeViews()
  // over the filled doc and rebuilds every block (four builds in dev, two in production).
  return (
    <>
      {providerSyncing ? cover : needsAuth && <SessionExpiredBanner />}
      <TiptapEditor
        inputMode={'text'}
        enterKeyHint={'enter'}
        autoFocus={isKeyboardOpen}
        ref={editorElement}
        className={twMerge(
          'tiptap__editor docy_editor relative w-full',
          fadeIn && 'motion-safe:animate-[doc-content-in_240ms_ease-out_both]',
          className,
          providerSyncing && 'hidden'
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
