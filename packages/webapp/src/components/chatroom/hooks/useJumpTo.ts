import type { ChatItem } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { supabaseClient } from '@utils/supabase'
import type { ItemLocation, VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

import { parseWindow } from './useChannelMessages'

export type JumpTarget = { mode: 'present' } | { mode: 'message'; id: string }

export const useJumpTo = (
  channelId: string,
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>,
  dataIncludesTailRef: React.MutableRefObject<boolean>
) =>
  useCallback(
    async (target: JumpTarget) => {
      const anchorKind = target.mode === 'present' ? 'tail' : 'message_id'
      const anchorValue = target.mode === 'message' ? target.id : undefined
      const { data, error } = await supabaseClient.rpc('fetch_message_window', {
        p_channel_id: channelId,
        p_anchor_kind: anchorKind,
        p_anchor_value: anchorValue,
        p_before_limit: 80,
        p_after_limit: target.mode === 'present' ? 0 : 40
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
      dataIncludesTailRef.current = target.mode === 'present' ? true : !win.has_more_after
      const initialLocation: ItemLocation = (() => {
        if (target.mode === 'present') return { index: 'LAST', align: 'end', behavior: 'instant' }
        const idx = items.findIndex((i) => isMessage(i) && i.id === target.id)
        if (idx < 0) return { index: 'LAST', align: 'end', behavior: 'instant' }
        return { index: idx, align: 'center', behavior: 'instant' }
      })()
      listRef.current?.data.replace(items, { initialLocation, purgeItemSizes: true })
    },
    [channelId, listRef, dataIncludesTailRef]
  )
