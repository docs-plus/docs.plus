import type { ChatItem } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { supabaseClient } from '@utils/supabase'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

import { parseWindow } from './useChannelMessages'

export const useScrollToMessage = (
  channelId: string,
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>,
  dataIncludesTailRef: React.MutableRefObject<boolean>
) =>
  useCallback(
    async (messageId: string) => {
      const existingIdx = listRef.current?.data.findIndex((i) => isMessage(i) && i.id === messageId)
      if (typeof existingIdx === 'number' && existingIdx >= 0) {
        listRef.current?.scrollToItem({ index: existingIdx, align: 'center', behavior: 'smooth' })
        return
      }
      const { data, error } = await supabaseClient.rpc('fetch_message_window', {
        p_channel_id: channelId,
        p_anchor_kind: 'message_id',
        p_anchor_value: messageId,
        p_before_limit: 40,
        p_after_limit: 40
      })
      if (error || !data) return
      const win = parseWindow(data)

      const items: ChatItem[] = []
      let prevDate: string | null = null
      for (const row of win.rows) {
        const d = (row.created_at ?? '').slice(0, 10)
        if (d && d !== prevDate) {
          items.push({ kind: 'day', id: `day-${d}-${channelId}`, date: d })
          prevDate = d
        }
        items.push({
          kind: 'message',
          id: row.id,
          client_id: row.client_id,
          seq: row.seq,
          status: 'sent',
          row
        })
      }
      dataIncludesTailRef.current = !win.has_more_after
      const targetIdx = items.findIndex((i) => isMessage(i) && i.id === messageId)
      listRef.current?.data.replace(items, {
        initialLocation:
          targetIdx >= 0
            ? { index: targetIdx, align: 'center', behavior: 'instant' }
            : { index: 'LAST', align: 'end', behavior: 'instant' },
        purgeItemSizes: true
      })
    },
    [channelId, listRef, dataIncludesTailRef]
  )
