import { useChatStore } from '@stores'
import { useMemo } from 'react'

/**
 * Hook to get unread message count for a specific channel/heading
 */
export function useUnreadCount(channelId: string): number {
  const channels = useChatStore((state) => state.channels)

  return useMemo(() => {
    const channel = channels.get(channelId)
    const count = channel?.unread_message_count ?? 0
    return Math.min(count, 99)
  }, [channels, channelId])
}
