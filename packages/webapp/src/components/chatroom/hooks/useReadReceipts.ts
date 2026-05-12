import { markReadMessages } from '@api'
import { useChatStore } from '@stores'
import type { Profile, TMsgRow } from '@types'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useMessageFeedContext } from '../components/MessageFeed/MessageFeedContext'

interface UseReadReceiptsArgs {
  channelId: string
  messages: ReadonlyArray<TMsgRow>
  profile: Profile | null
}

const FLUSH_DEBOUNCE_MS = 200

/**
 * Mark-as-read coordinator. Finds the newest message intersecting the
 * viewport, filters out pending/failed rows, only considers rows newer
 * than the cached lastReadMessageTimestamp, then fires
 * mark_messages_as_read once. Local writes are limited to that
 * timestamp — lastReadMessageId rehydrates from the next channel boot
 * via get_channel_aggregate_data.
 */
export const useReadReceipts = ({ channelId, messages, profile }: UseReadReceiptsArgs) => {
  const { messageContainerRef, virtualizerRef } = useMessageFeedContext()
  const setWorkspaceChannelSetting = useChatStore((s) => s.setWorkspaceChannelSetting)
  const channels = useChatStore((s) => s.workspaceSettings.channels)

  const lastReadTimestampMs = useMemo(() => {
    const stored = channels.get(channelId)?.lastReadMessageTimestamp
    return stored ? new Date(stored).getTime() : 0
  }, [channels, channelId])

  const lastReadRef = useRef<number>(lastReadTimestampMs)
  useEffect(() => {
    lastReadRef.current = lastReadTimestampMs
  }, [lastReadTimestampMs])

  const scan = useCallback(() => {
    const v = virtualizerRef.current
    const root = messageContainerRef.current
    if (!v || !profile || messages.length === 0) return

    const scrollEl = (v.scrollElement as HTMLElement | null) ?? root
    const viewportTop = scrollEl?.scrollTop ?? v.scrollOffset ?? 0
    const viewportH = scrollEl?.clientHeight ?? root?.clientHeight ?? 0
    if (viewportH === 0) return
    const viewportBottom = viewportTop + viewportH

    let newest: { id: string; ts: number } | null = null

    for (const item of v.getVirtualItems()) {
      if (item.end <= viewportTop || item.start >= viewportBottom) continue

      const message = messages[item.index]
      if (!message) continue

      // AGENTS rule: pending/failed rows MUST NOT advance the read cursor.
      if (message.status && message.status !== 'sent') continue

      const ts = new Date(message.created_at).getTime()
      if (Number.isNaN(ts) || ts <= lastReadRef.current) continue

      if (!newest || ts > newest.ts) newest = { id: message.id, ts }
    }

    if (!newest) return

    setWorkspaceChannelSetting(
      channelId,
      'lastReadMessageTimestamp',
      new Date(newest.ts).toISOString() as unknown as Date
    )
    lastReadRef.current = newest.ts

    markReadMessages({ channelId, lastMessage: newest.id }).catch(console.error)
  }, [
    channelId,
    messages,
    profile,
    virtualizerRef,
    messageContainerRef,
    setWorkspaceChannelSetting
  ])

  // Trigger on messages change (covers realtime arrivals at rest).
  useEffect(() => {
    const t = window.setTimeout(scan, FLUSH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [scan])

  // Single debounced scroll listener.
  //
  // virtualizerRef.current is set by the virtualizer mounting inside
  // MessageLoop, which can happen AFTER this effect runs. Polling briefly
  // via rAF ensures we attach to the actual scroll element rather than
  // falling back to messageContainerRef when the virtualizer would have
  // provided a more accurate one.
  useEffect(() => {
    let rafId: number | null = null
    let scrollEl: HTMLElement | Window | null = null
    let handler: ReturnType<typeof debounce> | null = null

    const attach = () => {
      const v = virtualizerRef.current
      const candidate =
        (v?.scrollElement as HTMLElement | null) ?? messageContainerRef.current ?? null
      if (!candidate) {
        rafId = requestAnimationFrame(attach)
        return
      }
      scrollEl = candidate
      handler = debounce(scan, FLUSH_DEBOUNCE_MS)
      scrollEl.addEventListener('scroll', handler as unknown as EventListener, { passive: true })
    }

    attach()

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (handler && scrollEl) {
        handler.cancel()
        scrollEl.removeEventListener('scroll', handler as unknown as EventListener)
      }
    }
  }, [scan, virtualizerRef, messageContainerRef])
}
