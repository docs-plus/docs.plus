import { useChatStore } from '@stores'
import { resolveHeadingUnreadCount, resolveUnreadCount } from '@utils/unreadDisplay'

export function useUnreadCount(channelId: string): number {
  return useChatStore((state) => resolveUnreadCount(channelId, state))
}

/** For a TOC row or heading button, which knows only the toc-id (#402). */
export function useHeadingUnreadCount(headingId: string): number {
  return useChatStore((state) => resolveHeadingUnreadCount(headingId, state))
}
