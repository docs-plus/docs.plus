import type { ChatItem, MessageRow } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import type { Json } from '@types'
import type { MutableRefObject } from 'react'

export type AnchorKind = 'tail' | 'first_unread' | 'message_id'

export type MessageWindow = {
  rows: MessageRow[]
  anchor_seq: number | null
  has_more_before: boolean
  has_more_after: boolean
}

export const parseWindow = (data: Json): MessageWindow => {
  const obj = (data ?? {}) as {
    rows?: MessageRow[]
    anchor_seq?: number | null
    has_more_before?: boolean
    has_more_after?: boolean
  }
  return {
    rows: obj.rows ?? [],
    anchor_seq: obj.anchor_seq ?? null,
    has_more_before: Boolean(obj.has_more_before),
    has_more_after: Boolean(obj.has_more_after)
  }
}

export const buildItemsFromWindow = (
  win: MessageWindow,
  channelId: string,
  anchorKind: AnchorKind
): ChatItem[] => {
  const items: ChatItem[] = []
  let prevDate: string | null = null
  const insertUnreadAt = anchorKind === 'first_unread' ? win.anchor_seq : null

  for (const row of win.rows) {
    const date = (row.created_at ?? '').slice(0, 10)
    if (date && date !== prevDate) {
      items.push({ kind: 'day', id: `day-${date}-${channelId}`, date })
      prevDate = date
    }
    if (
      insertUnreadAt != null &&
      row.seq === insertUnreadAt &&
      !items.some((i) => i.kind === 'unread')
    ) {
      items.push({ kind: 'unread', id: `unread-${channelId}` })
    }
    items.push({
      kind: 'message',
      id: row.id,
      client_id: row.client_id ?? null,
      seq: row.seq,
      status: 'sent',
      row
    })
  }
  return items
}

/** After jump/scroll `data.replace`, keep pagination + read-cursor refs aligned with the window. */
export function applyWindowSeqRefs(
  win: MessageWindow,
  items: ChatItem[],
  refs: {
    oldestSeqRef: MutableRefObject<number | null>
    newestSeqRef: MutableRefObject<number | null>
    dataIncludesTailRef: MutableRefObject<boolean>
    setHasMoreOlder: (value: boolean) => void
  }
) {
  const seqs = items
    .filter(isMessage)
    .map((m) => m.seq)
    .filter((s): s is number => s != null)
  if (seqs.length) {
    refs.oldestSeqRef.current = Math.min(...seqs)
    refs.newestSeqRef.current = Math.max(...seqs)
  }
  refs.dataIncludesTailRef.current = !win.has_more_after
  refs.setHasMoreOlder(Boolean(win.has_more_before))
}
