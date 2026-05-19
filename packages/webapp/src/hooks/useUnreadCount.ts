import { useChatStore } from '@stores'

export function useUnreadCount(channelId: string): number {
  const serverCount = useChatStore(
    (state) => state.channels.get(channelId)?.unread_message_count ?? 0
  )
  const optimistic = useChatStore((state) => state.optimisticUnread.get(channelId))
  return typeof optimistic === 'number' ? optimistic : serverCount
}
