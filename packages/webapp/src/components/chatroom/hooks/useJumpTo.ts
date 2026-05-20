import type { ChatItem } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { fetchMessageWindow } from '@components/chatroom/utils/fetchMessageWindow'
import { applyWindowSeqRefs } from '@components/chatroom/utils/messageWindow'
import type { ItemLocation, VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

export type JumpTarget = { mode: 'present' } | { mode: 'message'; id: string }

type WindowRefs = {
  oldestSeqRef: React.MutableRefObject<number | null>
  newestSeqRef: React.MutableRefObject<number | null>
  dataIncludesTailRef: React.MutableRefObject<boolean>
  setHasMoreOlder: (value: boolean) => void
}

export const useJumpTo = (
  channelId: string,
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>,
  windowRefs: WindowRefs
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
      const initialLocation: ItemLocation = (() => {
        if (target.mode === 'present') return { index: 'LAST', align: 'end', behavior: 'instant' }
        const idx = items.findIndex((i) => isMessage(i) && i.id === target.id)
        if (idx < 0) return { index: 'LAST', align: 'end', behavior: 'instant' }
        return { index: idx, align: 'center', behavior: 'instant' }
      })()
      listRef.current?.data.replace(items, { initialLocation, purgeItemSizes: true })
    },
    [channelId, listRef, windowRefs]
  )
