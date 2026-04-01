import { publishUnreadSync } from '@services/eventsHub'
import { useChatStore } from '@stores'
import { useEffect } from 'react'

/**
 * Hook to sync unread counts to DOM via UNREAD_SYNC event.
 * Should be called once at the app/document level.
 *
 * Architecture:
 * 1. Subscribes to zustand chat store
 * 2. Publishes UNREAD_SYNC event when channels change
 * 3. Event handler updates DOM attributes for editor heading buttons + notification bell
 * 4. TOC unread uses useUnreadCount + UnreadBadge (React); UNREAD_SYNC clears stale attrs on .toc__chat-trigger
 *
 * Performance:
 * - Zero React re-renders for badge elements
 * - CSS animations are GPU-accelerated
 * - Single event for all badge updates
 */
export function useUnreadSync() {
  const channels = useChatStore((state) => state.channels)

  useEffect(() => {
    // Publish event to update all badges via DOM
    publishUnreadSync()
  }, [channels])
}
