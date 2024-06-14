import { useMemo } from 'react'
import { useChatStore } from '@stores'

const useUnreadMessage = (item) => {
  const channels = useChatStore((state) => state.channels)

  const unreadMessage = useMemo(() => {
    const unreadMessage = channels.get(item.id)?.unread_message_count
    return unreadMessage > 99 ? '99+' : unreadMessage
  }, [channels, item.id])

  return unreadMessage
}

export default useUnreadMessage
