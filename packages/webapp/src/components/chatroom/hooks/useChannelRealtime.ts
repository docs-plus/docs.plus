import type { ChatItem, MessageItem } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { supabaseClient } from '@utils/supabase'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback, useEffect, useRef } from 'react'

export type BufferedArrival = { count: number; hasMention: boolean }

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
            // Postgres_changes payloads are raw messages.* — they don't
            // carry the computed columns from the RPCs (user_details,
            // is_bookmarked, bookmark_id). Use `user_details` presence
            // as the discriminator: when present, the row was hydrated
            // by fetch_message_window / fetch_messages_since and is
            // authoritative for all computed fields. When absent, this
            // is a postgres_changes payload (reaction add, edit, etc.)
            // and we MUST preserve the existing in-memory row's
            // computed fields — otherwise reactions blank out the
            // avatar AND wipe the bookmark indicator.
            const incomingRow = (item.row ?? {}) as any
            const existingRow = (i.row ?? {}) as any
            const isHydrated = incomingRow.user_details != null
            const mergedRow = isHydrated
              ? incomingRow
              : {
                  ...incomingRow,
                  user_details: existingRow.user_details ?? null,
                  is_bookmarked: existingRow.is_bookmarked,
                  bookmark_id: existingRow.bookmark_id
                }
            return { ...item, row: mergedRow }
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
              const incomingRow = (item.row ?? {}) as any
              const existingRow = (i.row ?? {}) as any
              const mergedRow = incomingRow.user_details
                ? incomingRow
                : { ...incomingRow, user_details: existingRow.user_details ?? null }
              return { ...item, row: mergedRow }
            }
            return i
          })
          if (merged) continue
          // Always defer to `atBottom`: optimistic append in useSendMessage
          // already moved the viewport when appropriate, so an own-echo
          // arriving while scrolled up must not yank the reader back down.
          listRef.current?.data.append([item], ({ atBottom }) => (atBottom ? 'smooth' : false))
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
  }, [listRef, dataIncludesTailRef, currentUsername, onBufferedArrival])

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
      // Loop until the server returns fewer than CATCHUP_PAGE rows (i.e. the
      // gap is closed). `fetch_messages_since` truncates at p_limit, so a
      // single-shot 100-row call silently drops anything past that — a user
      // returning to a busy channel after hours would lose the middle. Cap
      // pages so a runaway gap (or a misbehaving server) can't spin forever;
      // realtime stays correct going forward even if we bail.
      const CATCHUP_PAGE = 100
      const MAX_PAGES = 20
      for (let page = 0; page < MAX_PAGES; page++) {
        if (!mountedRef.current) return
        const since = newestSeqRef.current ?? 0
        const { data, error } = await supabaseClient.rpc('fetch_messages_since', {
          p_channel_id: channelId,
          p_since_seq: since,
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
          if (!dataIncludesTailRef.current) detachedBufferRef.current.push(item)
          newestSeqRef.current = Math.max(newestSeqRef.current ?? 0, row.seq)
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
          newestSeqRef.current = Math.max(newestSeqRef.current ?? 0, row.seq)
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
  }, [channelId, listRef, newestSeqRef, dataIncludesTailRef, scheduleFlush])
}
