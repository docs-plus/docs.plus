import { useMemo } from 'react'
import { useChatStore } from '@stores'

/**
 * Hook to get unread message count for a heading channel.
 */
const useUnreadCount = (headingId: string): number => {
  const channels = useChatStore((state) => state.channels)

  const unreadCount = useMemo(() => {
    if (!headingId) return 0
    const channel = channels.get(headingId)
    const count = channel?.unread_message_count ?? 0
    return count > 99 ? 99 : count
  }, [channels, headingId])

  return unreadCount
}

export default useUnreadCount
