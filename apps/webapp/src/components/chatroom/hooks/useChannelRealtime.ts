import { fetchChannelInitialData } from '@api'
import type { ChatItem, MessageItem, MessageRow } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import {
  type ChannelFeedMode,
  feedCatchupRpc,
  isMediaOnlyFeedMode,
  messageHasMedia,
  messageItemVisibleInFeed,
  shouldIncludeMessageInFeed
} from '@components/chatroom/utils/channelFeedProjection'
import { useChatStore } from '@stores'
import { captureMessageOnce } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback, useEffect, useRef } from 'react'

export type BufferedArrival = { count: number; hasMention: boolean }

// Once per topic+status: the subscribe callback re-fires on every reconnect
// attempt, which would flood identical events.
const captureRealtimeIssueOnce = (topic: string, status: string, channelId: string) =>
  captureMessageOnce(`${topic}:${status}`, `realtime:${status} (${topic})`, {
    level: 'error',
    tags: { surface: 'realtime', status, channelId }
  })

// postgres_changes payloads omit RPC-computed columns (user_details,
// is_bookmarked, bookmark_id). Use `user_details` presence as the
// discriminator: hydrated → authoritative; raw → graft existing. Both
// merge sites call this so the AGENTS.md lockstep rule is enforced.
const mergeRowPreservingComputedColumns = (
  incoming: MessageRow | null | undefined,
  existing: MessageRow | null | undefined
): MessageRow => {
  const i = (incoming ?? {}) as MessageRow
  if (i.user_details != null) return i
  const e = (existing ?? {}) as MessageRow
  return {
    ...i,
    user_details: e.user_details ?? null,
    is_bookmarked: e.is_bookmarked,
    bookmark_id: e.bookmark_id
  }
}

export type ChannelRealtimeArgs = {
  channelId: string
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>
  newestSeqRef: React.MutableRefObject<number | null>
  dataIncludesTailRef: React.MutableRefObject<boolean>
  currentUserId: string | null
  currentUsername: string | null
  onBufferedArrival: (delta: BufferedArrival) => void
  feedMode?: ChannelFeedMode
}

export const useChannelRealtime = ({
  channelId,
  listRef,
  newestSeqRef,
  dataIncludesTailRef,
  currentUserId,
  currentUsername,
  onBufferedArrival,
  feedMode = 'all'
}: ChannelRealtimeArgs) => {
  const feedModeRef = useRef(feedMode)
  feedModeRef.current = feedMode
  const arrivalBufferRef = useRef<Map<string, MessageItem>>(new Map())
  const updateBufferRef = useRef<Map<string, MessageItem>>(new Map())
  const deleteBufferRef = useRef<Set<string>>(new Set())
  const detachedBufferRef = useRef<MessageItem[]>([])
  const flushScheduledRef = useRef(false)
  const mountedRef = useRef(true)
  const pendingRafRef = useRef<number | null>(null)
  const catchUpInFlightRef = useRef(false)
  // Upper bound on Virtuoso mount-wait. At 60fps this is ~5s — well past
  // any realistic measure delay; past that the rAF poll would be spinning
  // on a permanently-empty handle (error boundary, route flip, mobile
  // tab background) and is safe to drop.
  const MAX_DRAIN_ATTEMPTS = 300

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return
    flushScheduledRef.current = true
    // Virtuoso's imperative handle may not be attached yet when the catchup
    // RPC resolves on initial mount; without this poll, the SUBSCRIBED→
    // fetch_messages_since→scheduleFlush→data.append chain runs against a
    // null `listRef.current` and every row is silently dropped via `?.`.
    let attempts = 0
    const drain = () => {
      pendingRafRef.current = null
      if (!mountedRef.current) {
        flushScheduledRef.current = false
        return
      }
      if (!listRef.current?.data) {
        if (++attempts >= MAX_DRAIN_ATTEMPTS) {
          flushScheduledRef.current = false
          return
        }
        pendingRafRef.current = requestAnimationFrame(drain)
        return
      }
      // Gate on the initial fetch_message_window setting newestSeqRef: arrivals
      // captured before it resolves would append onto an empty list, survive
      // data.replace, and land AFTER the window items — a reversed pagination
      // block (newer at top, older at tail).
      if (newestSeqRef.current == null) {
        if (++attempts >= MAX_DRAIN_ATTEMPTS) {
          flushScheduledRef.current = false
          return
        }
        pendingRafRef.current = requestAnimationFrame(drain)
        return
      }
      flushScheduledRef.current = false
      const arrivals = [...arrivalBufferRef.current.values()]
      const updates = [...updateBufferRef.current.values()]
      const deletes = [...deleteBufferRef.current]
      const detached = detachedBufferRef.current
      arrivalBufferRef.current.clear()
      updateBufferRef.current.clear()
      deleteBufferRef.current.clear()
      detachedBufferRef.current = []

      for (const item of updates) {
        if (!messageItemVisibleInFeed(item, feedModeRef.current)) {
          listRef.current?.data.findAndDelete((i: ChatItem) => isMessage(i) && i.id === item.id)
          continue
        }
        listRef.current?.data.map((i) => {
          if (isMessage(i) && i.id === item.id) {
            return { ...item, row: mergeRowPreservingComputedColumns(item.row, i.row) }
          }
          return i
        })
      }
      for (const id of deletes) {
        listRef.current?.data.findAndDelete((i: ChatItem) => isMessage(i) && i.id === id)
      }

      const sorted = arrivals
        .slice()
        .sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity))
        .filter((item) => messageItemVisibleInFeed(item, feedModeRef.current))

      if (dataIncludesTailRef.current) {
        for (const item of sorted) {
          // Try in-place merge (covers optimistic → echo reconciliation).
          let merged = false
          listRef.current?.data.map((i) => {
            if (isMessage(i) && i.id === item.id) {
              merged = true
              return { ...item, row: mergeRowPreservingComputedColumns(item.row, i.row) }
            }
            return i
          })
          if (merged) {
            if (typeof item.seq === 'number') {
              newestSeqRef.current = Math.max(newestSeqRef.current ?? 0, item.seq)
            }
            continue
          }
          // Pending-block fence: own optimistic sends sit at the tail as
          // `pending` until their echo merges in place, so a peer arrival
          // appended after them leaves the later echo stuck behind the peer —
          // an out-of-order tail. Insert before the first pending item.
          const pendingIdx = listRef.current?.data.findIndex(
            (i: ChatItem) => isMessage(i) && i.status === 'pending'
          )
          if (typeof pendingIdx === 'number' && pendingIdx >= 0) {
            listRef.current?.data.insert([item], pendingIdx)
          } else {
            // Always defer to `atBottom`: optimistic append in useSendMessage
            // already moved the viewport when appropriate, so an own-echo
            // arriving while scrolled up must not yank the reader back down.
            listRef.current?.data.append([item], ({ atBottom }) => (atBottom ? 'smooth' : false))
          }
          if (typeof item.seq === 'number') {
            newestSeqRef.current = Math.max(newestSeqRef.current ?? 0, item.seq)
          }
        }
      } else if (detached.length > 0) {
        const tag = currentUsername ? `@${currentUsername}` : null
        const hasMention = tag
          ? detached.some(
              (m) =>
                typeof (m.row as any)?.content === 'string' && (m.row as any).content.includes(tag)
            )
          : false
        onBufferedArrival({ count: detached.length, hasMention })
      }
    }
    pendingRafRef.current = requestAnimationFrame(drain)
  }, [listRef, newestSeqRef, dataIncludesTailRef, currentUsername, onBufferedArrival])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pendingRafRef.current != null) {
        cancelAnimationFrame(pendingRafRef.current)
        pendingRafRef.current = null
      }
      flushScheduledRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!channelId) return

    // Re-seed peer_max_read_seq after a reconnect: a dropped `read:advanced`
    // would otherwise leave sender-side check-marks stuck until reload.
    const refetchPeerSeq = async () => {
      if (!currentUserId) return
      const { data, error } = await fetchChannelInitialData({
        input_channel_id: channelId,
        message_limit: 0
      })
      if (error || !data) return
      const seq = (data as { peer_max_read_seq?: number | null }).peer_max_read_seq
      if (typeof seq === 'number' && seq > 0) {
        useChatStore.getState().setPeerReadSeq(channelId, seq)
      }
    }

    const catchUp = async () => {
      // Reentrancy guard: rapid focus/online flapping can stack catchUp
      // chains (each up to 20 pages x 100 rows). Short-circuit if a prior
      // drain hasn't returned yet.
      if (catchUpInFlightRef.current) return
      catchUpInFlightRef.current = true
      try {
        await catchUpInner()
      } finally {
        catchUpInFlightRef.current = false
      }
    }

    const catchUpInner = async () => {
      // Wait for the initial fetch_message_window to set newestSeqRef: a fast
      // SUBSCRIBED on a slow fetch would fall through with `since=0`, pull the
      // whole channel history into arrivalBuffer, and tail-pile it after
      // data.replace. Bounded so a stalled fetch can't hang here.
      let waitAttempts = 0
      while (newestSeqRef.current == null && mountedRef.current && waitAttempts < 100) {
        await new Promise((r) => setTimeout(r, 50))
        waitAttempts++
      }
      if (!mountedRef.current || newestSeqRef.current == null) return
      // Page until a short response: `fetch_messages_since` truncates at
      // p_limit, so one call drops the middle of a long gap; MAX_PAGES bounds
      // a runaway. `sinceLocal` stays local — on mid-channel mounts these rows
      // go to detachedBuffer, so bumping newestSeqRef would disarm loadNewer.
      const CATCHUP_PAGE = 100
      const MAX_PAGES = 20
      let sinceLocal = newestSeqRef.current
      for (let page = 0; page < MAX_PAGES; page++) {
        if (!mountedRef.current) return
        const catchupRpc = feedCatchupRpc(feedModeRef.current)
        const { data, error } = await supabaseClient.rpc(catchupRpc, {
          p_channel_id: channelId,
          p_since_seq: sinceLocal,
          p_limit: CATCHUP_PAGE
        })
        if (error || !data || !Array.isArray(data) || data.length === 0) return
        for (const row of data) {
          if (!shouldIncludeMessageInFeed(row, feedModeRef.current)) continue
          const item: MessageItem = {
            kind: 'message',
            id: row.id,
            client_id: row.client_id,
            seq: row.seq,
            status: 'sent',
            row
          }
          arrivalBufferRef.current.set(row.id, item)
          // Intentionally NOT pushed to detachedBufferRef: these rows are
          // paginated out, not session arrivals, and counting them inflates
          // the JumpToPresent chip with phantom unreads. Genuine "new while
          // reading" still flows via the postgres_changes INSERT below.
          if (typeof row.seq === 'number' && row.seq > sinceLocal) sinceLocal = row.seq
        }
        scheduleFlush()
        if (data.length < CATCHUP_PAGE) return
      }

      console.warn(
        '[chatroom] fetch_messages_since catchup exceeded MAX_PAGES; remaining gap will surface on next snap-to-present'
      )
    }

    const ch = supabaseClient
      .channel(`chatroom:${channelId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload: any) => {
          const row = payload.new
          if (!shouldIncludeMessageInFeed(row, feedModeRef.current)) return
          const item: MessageItem = {
            kind: 'message',
            id: row.id,
            client_id: row.client_id,
            seq: row.seq,
            status: 'sent',
            row
          }
          arrivalBufferRef.current.set(row.id, item)
          if (!dataIncludesTailRef.current) detachedBufferRef.current.push(item)
          // newestSeqRef is intentionally NOT bumped here: it tracks the LIST's
          // max seq as loadNewer's `since` cursor, and arrivals routed to
          // detachedBuffer (mid-channel mount) must not race ahead and disarm
          // it. Drain updates the ref when items actually enter the list.
          scheduleFlush()
        }
      )
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload: any) => {
          const row = payload.new
          if (row.deleted_at) deleteBufferRef.current.add(row.id)
          else if (!messageHasMedia(row) && isMediaOnlyFeedMode(feedModeRef.current)) {
            deleteBufferRef.current.add(row.id)
          } else
            updateBufferRef.current.set(row.id, {
              kind: 'message',
              id: row.id,
              client_id: row.client_id,
              seq: row.seq,
              status: 'sent',
              row
            })
          scheduleFlush()
        }
      )
      .on(
        'broadcast',
        { event: 'message:deleted' },
        ({ payload }: { payload: { id?: string } }) => {
          // Anon viewers never get the postgres_changes UPDATE that flips
          // `deleted_at` (anon SELECT policy filters it out), so the trigger
          // `handle_message_soft_delete` broadcasts instead. Authed members
          // may get both; deleteBufferRef is a Set, so it stays idempotent.
          if (payload?.id) {
            deleteBufferRef.current.add(payload.id)
            scheduleFlush()
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') catchUp()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          captureRealtimeIssueOnce(`chatroom:${channelId}`, status, channelId)
        }
      })

    // Private topic gated by `chatroom_read_topic_access` on
    // realtime.messages (members only). Split from `chatroom:{id}`
    // so postgres_changes can stay on the public topic for anon
    // PUBLIC-channel readers.
    const readChannel = currentUserId
      ? supabaseClient
          .channel(`chatroom-read:${channelId}`, { config: { private: true } })
          .on(
            'broadcast',
            { event: 'read:advanced' },
            ({ payload }: { payload: { user_id?: string; seq?: number } }) => {
              if (!payload?.user_id || typeof payload.seq !== 'number') return
              if (payload.user_id === currentUserId) return
              useChatStore.getState().setPeerReadSeq(channelId, payload.seq)
            }
          )
          .subscribe((status: string) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              captureRealtimeIssueOnce(`chatroom-read:${channelId}`, status, channelId)
            }
          })
      : null

    const onOnline = () => {
      void refetchPeerSeq()
      void catchUp()
    }
    const onFocus = () => catchUp()
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      supabaseClient.removeChannel(ch)
      if (readChannel) supabaseClient.removeChannel(readChannel)
    }
  }, [channelId, listRef, newestSeqRef, dataIncludesTailRef, currentUserId, scheduleFlush])
}
