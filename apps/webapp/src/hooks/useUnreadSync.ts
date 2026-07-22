import { syncHeadingWidgetUnread } from '@services/headingWidgetUnread'
import { useChatStore, useStore } from '@stores'
import { useLayoutEffect } from 'react'

/**
 * Sync channel unread onto ProseMirror `.ha-chat-btn` widgets (CSS ::before).
 * TOC / header / bell use React UnreadBadge — they do not need this hook.
 * Call once at the app/document level.
 */
export function useUnreadSync() {
  const channels = useChatStore((state) => state.channels)
  const optimisticUnread = useChatStore((state) => state.optimisticUnread)
  const unreadSuppressedChannelId = useChatStore((state) => state.unreadSuppressedChannelId)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  useLayoutEffect(() => {
    if (providerSyncing || !editor) return
    syncHeadingWidgetUnread()
  }, [channels, optimisticUnread, unreadSuppressedChannelId, providerSyncing, editor])
}
