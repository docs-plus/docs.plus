import type { ChatItem } from '@components/chatroom/types/chat-items'
import { fetchMessageWindow } from '@components/chatroom/utils/fetchMessageWindow'
import {
  applyWindowSeqRefs,
  type MessageWindowRefs
} from '@components/chatroom/utils/messageWindow'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

type ListRef = React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>

// Virtuoso lands in about 2 frames. The cap only stops a hang when the list never renders.
const MAX_REPLACE_FRAMES = 30

/**
 * A purge replace lands only after Virtuoso renders an empty list and waits one frame.
 * Resolve after it lands, or a caller's next append (a send) goes into the old window,
 * and the landing drops it.
 */
const whenReplaced = (listRef: ListRef, items: ChatItem[]) =>
  new Promise<void>((resolve) => {
    let frame = 0
    const check = () => {
      const data = listRef.current?.data.get()
      const landed = !data || (items.length === 0 ? data.length === 0 : data.includes(items[0]))
      if (landed || frame++ >= MAX_REPLACE_FRAMES) resolve()
      else requestAnimationFrame(check)
    }
    check()
  })

export const useJumpTo = (channelId: string, listRef: ListRef, windowRefs: MessageWindowRefs) =>
  useCallback(async () => {
    const result = await fetchMessageWindow({
      channelId,
      anchorKind: 'tail',
      beforeLimit: 80,
      afterLimit: 0
    })
    if (!result) return

    const { win, items } = result
    applyWindowSeqRefs(win, items, windowRefs)
    listRef.current?.data.replace(items, {
      initialLocation: { index: 'LAST', align: 'end', behavior: 'instant' },
      purgeItemSizes: true
    })
    await whenReplaced(listRef, items)
  }, [channelId, listRef, windowRefs])
