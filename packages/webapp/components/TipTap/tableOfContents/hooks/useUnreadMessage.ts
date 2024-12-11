import { useMemo } from 'react'
import { useChatStore } from '@stores'

type Props = {
  id: string
}

const useUnreadMessage = ({ id }: Props) => {
  const channels = useChatStore((state) => state.channels)

  const unreadMessage = useMemo(() => {
    // @ts-ignore
    const unreadMessage = channels.get(id)?.unread_message_count
    return unreadMessage > 99 ? '99+' : unreadMessage
  }, [channels, id])

  return unreadMessage
}

export default useUnreadMessage
