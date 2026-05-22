import type { ChatItem } from '@components/chatroom/types/chat-items'
import { fetchMessageWindow } from '@components/chatroom/utils/fetchMessageWindow'
import {
  applyWindowSeqRefs,
  findMessageItemIndex,
  type MessageWindowRefs
} from '@components/chatroom/utils/messageWindow'
import type { ItemLocation, VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

export type JumpTarget = { mode: 'present' } | { mode: 'message'; id: string }

export const useJumpTo = (
  channelId: string,
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>,
  windowRefs: MessageWindowRefs
) =>
  useCallback(
    async (target: JumpTarget) => {
      const anchorKind = target.mode === 'present' ? 'tail' : 'message_id'
      const anchorValue = target.mode === 'message' ? target.id : undefined
      const result = await fetchMessageWindow({
        channelId,
        anchorKind,
        anchorValue,
        beforeLimit: 80,
        afterLimit: target.mode === 'present' ? 0 : 40
      })
      if (!result) return

      const { win, items } = result
      applyWindowSeqRefs(win, items, windowRefs)

      let initialLocation: ItemLocation
      if (target.mode === 'present') {
        initialLocation = { index: 'LAST', align: 'end', behavior: 'instant' }
      } else {
        const idx = findMessageItemIndex(items, target.id)
        initialLocation =
          idx >= 0
            ? { index: idx, align: 'center', behavior: 'instant' }
            : { index: 'LAST', align: 'end', behavior: 'instant' }
      }

      listRef.current?.data.replace(items, { initialLocation, purgeItemSizes: true })
    },
    [channelId, listRef, windowRefs]
  )
