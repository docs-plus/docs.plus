import { useMemo } from 'react'
import { useChatStore } from '@stores'

const useUnreadMessage = ({ id }: { id: string }): number => {
  const channels = useChatStore((state) => state.channels)

  const unreadMessage = useMemo(() => {
    const channel = channels.get(id)
    const unreadMessage = channel?.unread_message_count ?? 0
    return unreadMessage > 99 ? 99 : unreadMessage
  }, [channels, id])

  return unreadMessage
}

export default useUnreadMessage
