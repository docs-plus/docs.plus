import { publishUnreadSync } from '@services/eventsHub'
import { useChatStore } from '@stores'
import { useEffect } from 'react'

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

  useEffect(() => {
    // Publish event to update all badges via DOM
    publishUnreadSync()
  }, [channels])
}
