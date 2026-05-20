import type { ChatItem } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { fetchMessageWindow } from '@components/chatroom/utils/fetchMessageWindow'
import { applyWindowSeqRefs } from '@components/chatroom/utils/messageWindow'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

type WindowRefs = {
  oldestSeqRef: React.MutableRefObject<number | null>
  newestSeqRef: React.MutableRefObject<number | null>
  dataIncludesTailRef: React.MutableRefObject<boolean>
  setHasMoreOlder: (value: boolean) => void
}

export const useScrollToMessage = (
  channelId: string,
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>,
  windowRefs: WindowRefs
) =>
  useCallback(
    async (messageId: string) => {
      const existingIdx = listRef.current?.data.findIndex((i) => isMessage(i) && i.id === messageId)
      if (typeof existingIdx === 'number' && existingIdx >= 0) {
        listRef.current?.scrollToItem({ index: existingIdx, align: 'center', behavior: 'smooth' })
        return
      }
      const result = await fetchMessageWindow({
        channelId,
        anchorKind: 'message_id',
        anchorValue: messageId,
        beforeLimit: 40,
        afterLimit: 40
      })
      if (!result) return
      const { win, items } = result
      applyWindowSeqRefs(win, items, windowRefs)
      const targetIdx = items.findIndex((i) => isMessage(i) && i.id === messageId)
      listRef.current?.data.replace(items, {
        initialLocation:
          targetIdx >= 0
            ? { index: targetIdx, align: 'center', behavior: 'instant' }
            : { index: 'LAST', align: 'end', behavior: 'instant' },
        purgeItemSizes: true
      })
    },
    [channelId, listRef, windowRefs]
  )
