import SessionExpiredBanner from '@components/pages/document/components/SessionExpiredBanner'
import SyncErrorCard from '@components/pages/document/components/SyncErrorCard'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { EditorContent as TiptapEditorContent } from '@tiptap/react'
import { isSessionExpired, shouldShowSyncErrorWhileLoading } from '@utils/providerCollabStatus'

type HistoryEditorVariant = 'desktop' | 'mobile'

const SCROLL_ROOT: Record<HistoryEditorVariant, string> = {
  desktop:
    'editorWrapper bg-base-200 flex min-h-0 min-w-0 flex-1 items-start justify-center border-t-0 px-3 py-4 sm:px-6 sm:py-6',
  mobile:
    'editor editorWrapper history-mobile-editor flex h-full min-h-0 w-full min-w-0 flex-1 border-t-0'
}

const SKELETON_CLASS: Record<HistoryEditorVariant, string> = {
  desktop: 'mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8',
  mobile: 'docy_editor relative w-full'
}

const EDITOR_CLASS: Record<HistoryEditorVariant, string> = {
  desktop: 'tiptap__editor docy_editor mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8',
  mobile: 'tiptap__editor docy_editor relative w-full'
}

export function HistoryEditorContent({ variant }: { variant: HistoryEditorVariant }) {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const editor = useStore((state) => state.editor)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const providerStatus = useStore((state) => state.settings.providerStatus)

  const scrollRootClass = SCROLL_ROOT[variant]
  const skeletonClass = SKELETON_CLASS[variant]
  const editorClass = EDITOR_CLASS[variant]

  const needsAuth = isSessionExpired(providerStatus)

  if (providerSyncing && shouldShowSyncErrorWhileLoading(providerStatus)) {
    return (
      <ScrollArea className={scrollRootClass} scrollbarSize="thin">
        <SyncErrorCard
          offline={providerStatus === 'offline'}
          needsAuth={needsAuth}
          className={skeletonClass}
        />
      </ScrollArea>
    )
  }

  if (loadingHistory || !editor) {
    return (
      <ScrollArea className={scrollRootClass} scrollbarSize="thin">
        <EditorContentSkeleton className={skeletonClass} />
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className={scrollRootClass} scrollbarSize="thin">
      {needsAuth && <SessionExpiredBanner />}
      <TiptapEditorContent editor={editor} className={editorClass} />
    </ScrollArea>
  )
}
