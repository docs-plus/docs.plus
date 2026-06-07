import { useChatStore } from '@stores'

export function useUnreadCount(channelId: string): number {
  return useChatStore((state) => {
    if (state.unreadSuppressedChannelId === channelId) return 0
    const optimistic = state.optimisticUnread.get(channelId)
    if (typeof optimistic === 'number') return optimistic
    return state.channels.get(channelId)?.unread_message_count ?? 0
  })
}
