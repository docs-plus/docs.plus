import type { ChatItem, MessageRow } from '@components/chatroom/types/chat-items'
import { isDay, isMessage } from '@components/chatroom/types/chat-items'
import type { Json } from '@types'
import { supabaseClient } from '@utils/supabase'
import type { ItemLocation, VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback, useEffect, useRef, useState } from 'react'

export type AnchorKind = 'tail' | 'first_unread' | 'message_id'

export type MessageWindow = {
  rows: MessageRow[]
  anchor_seq: number | null
  has_more_before: boolean
  has_more_after: boolean
}

/** `fetch_message_window` returns Json; cast to the documented row+meta shape. */
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

export type ChannelMessagesArgs = {
  channelId: string
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>
  anchorKind: AnchorKind
  anchorValue?: string | null
  /** Fires once after the initial replace measures so the read cursor can
   *  catch the bottom-most visible message before any user scroll. */
  onInitialVisible?: (index: number) => void
}

const PAGE_LIMIT = 40

export const useChannelMessages = ({
  channelId,
  listRef,
  anchorKind,
  anchorValue,
  onInitialVisible
}: ChannelMessagesArgs) => {
  const [loading, setLoading] = useState(true)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const oldestSeqRef = useRef<number | null>(null)
  const newestSeqRef = useRef<number | null>(null)
  /** False after a non-tail data.replace; gates realtime appends. */
  const dataIncludesTailRef = useRef<boolean>(true)
  const loadingOlderRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabaseClient
      .rpc('fetch_message_window', {
        p_channel_id: channelId,
        p_anchor_kind: anchorKind,
        p_anchor_value: anchorValue ?? undefined,
        p_before_limit: PAGE_LIMIT,
        p_after_limit: PAGE_LIMIT
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[chatroom] fetch_message_window error:', error)
        }
        if (error || !data) {
          setLoading(false)
          return
        }
        const win = parseWindow(data)
        const items = buildItemsFromWindow(win, channelId, anchorKind)
        const seqs = items
          .filter(isMessage)
          .map((m) => m.seq)
          .filter((s): s is number => s != null)
        oldestSeqRef.current = seqs.length ? Math.min(...seqs) : null
        newestSeqRef.current = seqs.length ? Math.max(...seqs) : null
        setHasMoreOlder(Boolean(win.has_more_before))
        dataIncludesTailRef.current = !win.has_more_after
        // Virtuoso mounts in a later commit than the Provider's effect;
        // when the RPC resolves before that mount lands, listRef.current
        // is still null and `data.replace` silently no-ops via the `?.`.
        // Poll via rAF until the imperative handle attaches, then apply.
        const apply = () => {
          if (cancelled) return
          const list = listRef.current
          if (!list?.data) {
            requestAnimationFrame(apply)
            return
          }
          list.data.replace(items, {
            initialLocation: resolveInitialLocation(win, anchorKind, channelId, items),
            purgeItemSizes: true
          })
          setLoading(false)
          // `onScroll` is the read-cursor signal once the user moves, but
          // it doesn't fire from a `data.replace`. Read the post-measure
          // location off the imperative handle on the next frame to seed
          // the cursor with the bottom-most fully-visible row.
          if (onInitialVisible) {
            // Virtuoso measures items asynchronously after `data.replace`;
            // the first rAF can fire with `scrollHeight === visibleListHeight`
            // and a stale `lastVisibleItemIndex === 0` pointing at the day
            // sentinel. Poll a handful of frames until the scroller has
            // measured, then fire once with the settled index. Bounded so
            // we never spin on a permanently-empty list.
            let attempt = 0
            const tryInitialFire = () => {
              if (cancelled) return
              const loc = listRef.current?.getScrollLocation?.()
              const measured = loc && loc.scrollHeight > loc.visibleListHeight + 1
              if (!measured && attempt < 20) {
                attempt++
                requestAnimationFrame(tryInitialFire)
                return
              }
              if (loc && typeof loc.lastVisibleItemIndex === 'number') {
                onInitialVisible(loc.lastVisibleItemIndex)
              }
            }
            requestAnimationFrame(tryInitialFire)
          }
        }
        apply()
      })
    return () => {
      cancelled = true
    }
  }, [channelId, anchorKind, anchorValue, listRef, onInitialVisible])

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlder || oldestSeqRef.current == null) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    const { data, error } = await supabaseClient.rpc('fetch_message_window', {
      p_channel_id: channelId,
      p_anchor_kind: 'before_seq',
      p_anchor_value: String(oldestSeqRef.current),
      p_before_limit: PAGE_LIMIT,
      p_after_limit: 0
    })
    loadingOlderRef.current = false
    setLoadingOlder(false)
    if (error || !data) return
    const win = parseWindow(data)
    const olderItems = buildItemsFromWindow(win, channelId, 'tail')
    const olderMessageItems = olderItems.filter(isMessage)
    if (olderMessageItems.length === 0) {
      setHasMoreOlder(false)
      return
    }
    // Prepend boundary reconciliation: when the join would produce two
    // adjacent DayItems for the same date, drop the older-batch tail day
    // before prepending the rest.
    const lastPrepended = [...olderItems].reverse().find(isMessage)
    const lastPrependedDate = lastPrepended ? lastPrepended.row.created_at?.slice(0, 10) : null
    let droppedHeadDay = false
    if (lastPrependedDate) {
      listRef.current?.data.map((item, index) => {
        if (index === 0 && isDay(item) && item.date === lastPrependedDate) {
          droppedHeadDay = true
          // Sentinel — actual drop happens via findAndDelete below; we can't
          // return undefined from map, so just return the item and clean up.
        }
        return item
      })
    }
    if (droppedHeadDay) {
      listRef.current?.data.findAndDelete(
        (i, index) => index === 0 && isDay(i) && i.date === lastPrependedDate
      )
    }
    listRef.current?.data.prepend(olderItems)
    const seqs = olderMessageItems.map((m) => m.seq).filter((s): s is number => s != null)
    oldestSeqRef.current = seqs.length ? Math.min(...seqs) : oldestSeqRef.current
    setHasMoreOlder(Boolean(win.has_more_before))
  }, [channelId, hasMoreOlder, listRef])

  return {
    loading,
    loadingOlder,
    hasMoreOlder,
    loadOlder,
    oldestSeqRef,
    newestSeqRef,
    dataIncludesTailRef
  }
}

const buildItemsFromWindow = (
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

const tailLocation: ItemLocation = {
  index: 'LAST',
  align: 'end',
  behavior: 'instant'
}

/**
 * Virtuoso's `ItemLocation` is index-based (`number | 'LAST'`), not id-based;
 * passing `'lastItem'` or `{ id }` silently no-ops and leaves Virtuoso in its
 * empty-placeholder state even after `data.replace` populates the store.
 */
const resolveInitialLocation = (
  win: MessageWindow,
  anchorKind: AnchorKind,
  channelId: string,
  items: ChatItem[]
): ItemLocation => {
  if (anchorKind === 'tail') return tailLocation
  if (anchorKind === 'first_unread' && win.anchor_seq != null) {
    const unreadId = `unread-${channelId}`
    const idx = items.findIndex((i) => i.kind === 'unread' && i.id === unreadId)
    if (idx >= 0) return { index: idx, align: 'start', behavior: 'instant' }
    return tailLocation
  }
  const anchor = win.rows.find((r) => r.seq === win.anchor_seq)
  if (!anchor) return tailLocation
  const idx = items.findIndex((i) => i.kind === 'message' && i.id === anchor.id)
  if (idx < 0) return tailLocation
  return { index: idx, align: 'center', behavior: 'instant' }
}
