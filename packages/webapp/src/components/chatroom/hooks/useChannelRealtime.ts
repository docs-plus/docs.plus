import type { ChatItem, MessageItem, MessageRow } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { useChatStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback, useEffect, useRef } from 'react'

export type BufferedArrival = { count: number; hasMention: boolean }

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
}

export const useChannelRealtime = ({
  channelId,
  listRef,
  newestSeqRef,
  dataIncludesTailRef,
  currentUserId,
  currentUsername,
  onBufferedArrival
}: ChannelRealtimeArgs) => {
  const arrivalBufferRef = useRef<Map<string, MessageItem>>(new Map())
  const updateBufferRef = useRef<Map<string, MessageItem>>(new Map())
  const deleteBufferRef = useRef<Set<string>>(new Set())
  const detachedBufferRef = useRef<MessageItem[]>([])
  const flushScheduledRef = useRef(false)
  const mountedRef = useRef(true)
  const pendingRafRef = useRef<number | null>(null)
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
      // Wait for the initial fetch_message_window to populate the window
      // and set newestSeqRef. Without this gate, arrivals captured by
      // postgres_changes / catchUp before the window resolves would be
      // appended onto an empty list and then survive past data.replace,
      // landing AFTER the loaded window items — visible as a reversed
      // pagination block (newer at top, older at tail).
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

      const sorted = arrivals.slice().sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity))

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
          // Pending-block fence: own optimistic sends sit at the list tail
          // with `status: 'pending'` until their echo merges in place. A
          // peer arrival appended naïvely lands AFTER the pending block,
          // and when the user's own echo later merges by id it inherits
          // a position behind the peer — visible as an out-of-order tail.
          // Insert peer arrivals BEFORE the first trailing pending item
          // so the echo merge stays sort-correct.
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

    const catchUp = async () => {
      // Wait for the initial fetch_message_window to set newestSeqRef.
      // Without this, a fast SUBSCRIBED on a slow initial fetch falls
      // through with `since=0`, fetches the entire channel history into
      // arrivalBuffer, and those rows tail-pile after data.replace —
      // visible as reversed pagination (newer block on top, older on
      // bottom). Bounded so we don't hang forever on a stalled fetch.
      let waitAttempts = 0
      while (newestSeqRef.current == null && mountedRef.current && waitAttempts < 100) {
        await new Promise((r) => setTimeout(r, 50))
        waitAttempts++
      }
      if (!mountedRef.current || newestSeqRef.current == null) return
      // Loop until the server returns fewer than CATCHUP_PAGE rows (i.e. the
      // gap is closed). `fetch_messages_since` truncates at p_limit, so a
      // single-shot 100-row call silently drops anything past that — a user
      // returning to a busy channel after hours would lose the middle. Cap
      // pages so a runaway gap (or a misbehaving server) can't spin forever;
      // realtime stays correct going forward even if we bail.
      // Local pagination cursor — must NOT advance newestSeqRef because
      // catchUp messages route to detachedBuffer when the list doesn't
      // include the tail (deep-link / first_unread mid-channel mounts),
      // and loadNewer relies on newestSeqRef tracking LIST max only.
      const CATCHUP_PAGE = 100
      const MAX_PAGES = 20
      let sinceLocal = newestSeqRef.current
      for (let page = 0; page < MAX_PAGES; page++) {
        if (!mountedRef.current) return
        const { data, error } = await supabaseClient.rpc('fetch_messages_since', {
          p_channel_id: channelId,
          p_since_seq: sinceLocal,
          p_limit: CATCHUP_PAGE
        })
        if (error || !data || !Array.isArray(data) || data.length === 0) return
        for (const row of data) {
          const item: MessageItem = {
            kind: 'message',
            id: row.id,
            client_id: row.client_id,
            seq: row.seq,
            status: 'sent',
            row
          }
          arrivalBufferRef.current.set(row.id, item)
          // Intentionally NOT pushing to detachedBufferRef here: these rows
          // are paginated out, not session arrivals. Counting them inflates
          // the JumpToPresent chip with phantom unreads on deep-link or
          // first_unread mid-channel mounts. Genuine "new while reading"
          // still flows via the postgres_changes INSERT handler below.
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
          // newestSeqRef is intentionally NOT bumped here. It tracks the
          // LIST's max seq so loadNewer can use it as the `since` cursor;
          // arrivals routed to detachedBuffer (mid-channel mount) must not
          // race ahead of the list and disarm loadNewer. Drain updates the
          // ref when items actually enter the list.
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
          else
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
          // Anon viewers don't receive the postgres_changes UPDATE that flips
          // `deleted_at` (anon SELECT policy filters it out); the trigger
          // `handle_message_soft_delete` emits this broadcast so they prune
          // locally. Authed members may receive both signals — deleteBufferRef
          // is a Set, so the duplicate is idempotent.
          if (payload?.id) {
            deleteBufferRef.current.add(payload.id)
            scheduleFlush()
          }
        }
      )
      .on(
        'broadcast',
        { event: 'read:advanced' },
        ({ payload }: { payload: { user_id?: string; seq?: number } }) => {
          // Emitted by advance_read_cursor when a peer advances. Skip
          // until auth has hydrated — otherwise an own echo arriving in
          // the null-id window writes our own seq into peerReadSeq and
          // sticks (the setter is monotonic).
          if (!currentUserId) return
          if (!payload?.user_id || typeof payload.seq !== 'number') return
          if (payload.user_id === currentUserId) return
          useChatStore.getState().setPeerReadSeq(channelId, payload.seq)
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') catchUp()
      })

    const onOnline = () => catchUp()
    const onFocus = () => catchUp()
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      supabaseClient.removeChannel(ch)
    }
  }, [channelId, listRef, newestSeqRef, dataIncludesTailRef, currentUserId, scheduleFlush])
}
