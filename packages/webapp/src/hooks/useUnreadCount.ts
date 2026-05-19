import { useChatStore } from '@stores'

export function useUnreadCount(channelId: string): number {
  const serverCount = useChatStore(
    (state) => state.channels.get(channelId)?.unread_message_count ?? 0
  )
  const optical = useChatStore((state) => state.opticalUnread.get(channelId))
  return typeof optical === 'number' ? optical : serverCount
}
