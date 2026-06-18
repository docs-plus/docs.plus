import type { ChatItem } from '@components/chatroom/types/chat-items'
import { fetchMessageWindow } from '@components/chatroom/utils/fetchMessageWindow'
import {
  MESSAGE_FLASH_AFTER_INSTANT_SCROLL_MS,
  MESSAGE_FLASH_AFTER_SMOOTH_SCROLL_MS,
  scheduleMessageFlash
} from '@components/chatroom/utils/messageJumpTiming'
import {
  applyWindowSeqRefs,
  findMessageItemIndex,
  type MessageWindowRefs
} from '@components/chatroom/utils/messageWindow'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

export const useScrollToMessage = (
  channelId: string,
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>,
  windowRefs: MessageWindowRefs,
  flash: (messageId: string) => void
) =>
  useCallback(
    async (messageId: string) => {
      const items = listRef.current?.data.get() ?? []
      const existingIdx = findMessageItemIndex(items, messageId)
      if (existingIdx >= 0) {
        listRef.current?.scrollToItem({ index: existingIdx, align: 'center', behavior: 'smooth' })
        scheduleMessageFlash(flash, messageId, MESSAGE_FLASH_AFTER_SMOOTH_SCROLL_MS)
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

      const { win, items: windowItems } = result
      applyWindowSeqRefs(win, windowItems, windowRefs)
      const targetIdx = findMessageItemIndex(windowItems, messageId)
      listRef.current?.data.replace(windowItems, {
        initialLocation:
          targetIdx >= 0
            ? { index: targetIdx, align: 'center', behavior: 'instant' }
            : { index: 'LAST', align: 'end', behavior: 'instant' },
        purgeItemSizes: true
      })
      scheduleMessageFlash(flash, messageId, MESSAGE_FLASH_AFTER_INSTANT_SCROLL_MS)
    },
    [channelId, listRef, windowRefs, flash]
  )
