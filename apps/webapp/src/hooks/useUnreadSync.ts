import { publishUnreadSync } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { useLayoutEffect } from 'react'

/**
 * Hook to sync unread counts onto the ProseMirror heading-action chat buttons
 * (`.ha-chat-btn`) via data attributes. Those buttons are injected by a
 * ProseMirror plugin and can't host a React subtree, so they use CSS `::before`
 * driven by `data-unread-count`. Everything else (TOC, header, bell) uses the
 * React <UnreadBadge> component and does not need this hook.
 *
 * Call once at the app/document level.
 */
export function useUnreadSync() {
  const channels = useChatStore((state) => state.channels)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  useLayoutEffect(() => {
    // Channels often load before collab sync finishes; `.ha-chat-btn` widgets
    // only exist after the editor mounts. Re-run when either side becomes ready.
    if (providerSyncing || !editor) return
    publishUnreadSync()
  }, [channels, providerSyncing, editor])
}
