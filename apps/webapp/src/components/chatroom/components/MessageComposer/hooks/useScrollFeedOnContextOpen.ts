import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useEffect } from 'react'

/** When reply/edit opens at tail, nudge Virtuoso so the context bar stays in view. */
export const useScrollFeedOnContextOpen = (active: unknown) => {
  const { atBottom, listRef } = useChatroomContext()

  useEffect(() => {
    if (!active || !atBottom) return
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToItem({ index: 'LAST', align: 'end', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [active, atBottom, listRef])
}
