import { useChatStore } from '@stores'
import { useMemo } from 'react'

/**
 * Raw unread count for a channel/heading. Display caps (e.g. "99+") belong to the renderer.
 */
export function useUnreadCount(channelId: string): number {
  const channels = useChatStore((state) => state.channels)

  return useMemo(() => {
    const channel = channels.get(channelId)
    return channel?.unread_message_count ?? 0
  }, [channels, channelId])
}
