import type { ChatItem, MessageRow } from '@components/chatroom/types/chat-items'
import { isDay, isMessage } from '@components/chatroom/types/chat-items'
import {
  type ChannelFeedMode,
  feedCatchupRpc,
  feedUsesTailAnchor,
  feedWindowRpcBody,
  isMediaOnlyFeedMode
} from '@components/chatroom/utils/channelFeedProjection'
import {
  type AnchorKind,
  buildItemsFromWindow,
  findMessageItemIndex,
  type MessageWindow,
  parseWindow
} from '@components/chatroom/utils/messageWindow'
import { supabaseClient } from '@utils/supabase'
import type { ItemLocation, VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback, useEffect, useRef, useState } from 'react'

export type { AnchorKind, MessageWindow } from '@components/chatroom/utils/messageWindow'

export type ChannelMessagesArgs = {
  channelId: string
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>
  anchorKind: AnchorKind
  anchorValue?: string | null
  feedMode?: ChannelFeedMode
  /** Fires once after the initial replace measures so the read cursor can
   *  catch the bottom-most visible message before any user scroll. */
  onInitialVisible?: (index: number) => void
  /** Fires once when Virtuoso finishes measuring after the initial replace —
   *  for jump UX (flash) separate from read-cursor seeding. */
  onListScrollSettled?: () => void
}

const PAGE_LIMIT = 40

export const useChannelMessages = ({
  channelId,
  listRef,
  anchorKind,
  anchorValue,
  feedMode = 'all',
  onInitialVisible,
  onListScrollSettled
}: ChannelMessagesArgs) => {
  const [loading, setLoading] = useState(true)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadingNewer, setLoadingNewer] = useState(false)
  const oldestSeqRef = useRef<number | null>(null)
  const newestSeqRef = useRef<number | null>(null)
  /** False after a non-tail data.replace; gates realtime appends. */
  const dataIncludesTailRef = useRef<boolean>(true)
  const loadingOlderRef = useRef(false)
  const loadingNewerRef = useRef(false)

  const mediaOnly = isMediaOnlyFeedMode(feedMode)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const { rpc: windowRpc, body: windowBody } = feedWindowRpcBody(feedMode, {
      kind: 'initial',
      channelId,
      anchorKind,
      anchorValue,
      pageLimit: PAGE_LIMIT
    })

    supabaseClient.rpc(windowRpc, windowBody).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.warn(
          mediaOnly
            ? '[chatroom] fetch_media_message_window error:'
            : '[chatroom] fetch_message_window error:',
          error
        )
      }
      if (error || !data) {
        setLoading(false)
        return
      }
      const win = parseWindow(data)
      const buildAnchor = feedUsesTailAnchor(feedMode) ? 'tail' : anchorKind
      const items = buildItemsFromWindow(win, channelId, buildAnchor)
      const seqs = items
        .filter(isMessage)
        .map((m) => m.seq)
        .filter((s): s is number => s != null)
      oldestSeqRef.current = seqs.length ? Math.min(...seqs) : null
      newestSeqRef.current = seqs.length ? Math.max(...seqs) : null
      setHasMoreOlder(Boolean(win.has_more_before))
      dataIncludesTailRef.current = mediaOnly ? true : !win.has_more_after
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
        const initialLocation = mediaOnly
          ? tailLocation
          : resolveInitialLocation(win, anchorKind, channelId, items)
        list.data.replace(items, { initialLocation, purgeItemSizes: true })
        setLoading(false)
        // `align: 'end'` at `data.replace` time ignores the StickyHeader slot
        // height, so the initial scroll lands ~1 row short of the tail;
        // re-issue once measurements settle. The identity check on
        // `tailLocation` keeps anchored scrolls (first_unread, deep-link) free.
        if (initialLocation === tailLocation) {
          let tailAttempt = 0
          const settleTail = () => {
            if (cancelled) return
            const loc = listRef.current?.getScrollLocation?.()
            const measured = loc && loc.scrollHeight > loc.visibleListHeight + 1
            if (!measured && tailAttempt < 20) {
              tailAttempt++
              requestAnimationFrame(settleTail)
              return
            }
            listRef.current?.scrollToItem({
              index: 'LAST',
              align: 'end',
              behavior: 'instant'
            })
          }
          requestAnimationFrame(settleTail)
        }
        // `onScroll` is the read-cursor signal once the user moves, but
        // it doesn't fire from a `data.replace`. Read the post-measure
        // location off the imperative handle on the next frame to seed
        // the cursor with the bottom-most fully-visible row.
        if (onInitialVisible || onListScrollSettled) {
          // Virtuoso measures asynchronously after `data.replace`: the first
          // rAF can report `scrollHeight === visibleListHeight` and a stale
          // `lastVisibleItemIndex === 0` (the day sentinel). Poll until
          // measured, bounded so a permanently-empty list can't spin.
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
              onInitialVisible?.(loc.lastVisibleItemIndex)
            }
            onListScrollSettled?.()
          }
          requestAnimationFrame(tryInitialFire)
        }
      }
      apply()
    })
    return () => {
      cancelled = true
    }
  }, [
    channelId,
    anchorKind,
    anchorValue,
    listRef,
    feedMode,
    mediaOnly,
    onInitialVisible,
    onListScrollSettled
  ])

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlder || oldestSeqRef.current == null) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    const { rpc: windowRpc, body: windowBody } = feedWindowRpcBody(feedMode, {
      kind: 'older',
      channelId,
      beforeSeq: oldestSeqRef.current,
      pageLimit: PAGE_LIMIT
    })
    const { data, error } = await supabaseClient.rpc(windowRpc, windowBody)
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
    if (lastPrependedDate) {
      const head = listRef.current?.data.get()[0]
      if (head && isDay(head) && head.date === lastPrependedDate) {
        listRef.current?.data.findAndDelete(
          (i, index) => index === 0 && isDay(i) && i.date === lastPrependedDate
        )
      }
    }
    listRef.current?.data.prepend(olderItems)
    const seqs = olderMessageItems.map((m) => m.seq).filter((s): s is number => s != null)
    oldestSeqRef.current = seqs.length ? Math.min(...seqs) : oldestSeqRef.current
    setHasMoreOlder(Boolean(win.has_more_before))
  }, [channelId, hasMoreOlder, listRef, feedMode])

  // Disarmed once the window includes the tail: from there realtime
  // postgres_changes is the source of new messages and a fetch would loop on
  // empty pages. A short response (< PAGE_LIMIT) is the tail signal that
  // flips dataIncludesTailRef.
  const loadNewer = useCallback(async () => {
    if (mediaOnly) return
    if (loadingNewerRef.current) return
    if (dataIncludesTailRef.current) return
    if (newestSeqRef.current == null) return
    loadingNewerRef.current = true
    setLoadingNewer(true)
    const catchupRpc = feedCatchupRpc(feedMode)
    const { data, error } = await supabaseClient.rpc(catchupRpc, {
      p_channel_id: channelId,
      p_since_seq: newestSeqRef.current,
      p_limit: PAGE_LIMIT
    })
    loadingNewerRef.current = false
    setLoadingNewer(false)
    if (error || !Array.isArray(data) || data.length === 0) {
      if (!error) dataIncludesTailRef.current = true
      return
    }
    const rows = data as MessageRow[]
    // Build items with a leading day separator only if the date crosses
    // the boundary with the last currently-loaded message.
    const items: ChatItem[] = []
    const existing = listRef.current?.data.get() ?? []
    let prevDate: string | null = null
    for (let i = existing.length - 1; i >= 0; i--) {
      const it = existing[i]
      if (isMessage(it)) {
        prevDate = it.row.created_at?.slice(0, 10) ?? null
        break
      }
    }
    for (const row of rows) {
      const date = (row.created_at ?? '').slice(0, 10)
      if (date && date !== prevDate) {
        items.push({ kind: 'day', id: `day-${date}-${channelId}`, date })
        prevDate = date
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
    // `false` (no autoscroll) is required: the default at-bottom callback
    // smooth-scrolls every page, because loadNewer fires inside
    // LOAD_NEWER_PX_THRESHOLD and the post-append snap re-triggers it —
    // a runaway scroll to tail. Pagination must keep the viewport anchored.
    listRef.current?.data.append(items, false)
    const seqs = items
      .filter(isMessage)
      .map((m) => m.seq)
      .filter((s): s is number => s != null)
    newestSeqRef.current = seqs.length
      ? Math.max(newestSeqRef.current ?? 0, ...seqs)
      : newestSeqRef.current
    if (rows.length < PAGE_LIMIT) dataIncludesTailRef.current = true
  }, [channelId, listRef, feedMode, mediaOnly])

  return {
    loading,
    loadingOlder,
    hasMoreOlder,
    setHasMoreOlder,
    loadOlder,
    loadingNewer,
    loadNewer,
    oldestSeqRef,
    newestSeqRef,
    dataIncludesTailRef
  }
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
  const idx = findMessageItemIndex(items, anchor.id)
  if (idx < 0) return tailLocation
  return { index: idx, align: 'center', behavior: 'instant' }
}
