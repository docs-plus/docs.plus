import { useMemo } from 'react'
import { useChatStore } from '@stores'

const useUnreadMessage = ({ id }: { id: string }) => {
  const channels = useChatStore((state) => state.channels)

  const unreadMessage = useMemo(() => {
    const channel = channels.get(id)
    const count = channel?.unread_message_count ?? 0
    console.log({ channel })
    const totalMessageCount = channel?.count?.message_count ?? 0
    return count > 99 ? 99 : count + totalMessageCount
  }, [channels, id])

  return unreadMessage
}

export default useUnreadMessage
