import { Modal, ModalContent } from '@components/ui/Dialog'
import { useUnreadCount } from '@hooks/useUnreadCount'
import { useAuthStore, useChatStore } from '@stores'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { useChannelMessages } from './hooks/useChannelMessages'
import { useChannelMetadata } from './hooks/useChannelMetadata'
import { type BufferedArrival, useChannelRealtime } from './hooks/useChannelRealtime'
import { useJumpTo } from './hooks/useJumpTo'
import { useMessageHighlight } from './hooks/useMessageHighlight'
import { useReadCursor } from './hooks/useReadCursor'
import { useScrollToMessage } from './hooks/useScrollToMessage'
import { useSendMessage } from './hooks/useSendMessage'
import type { ChatItem } from './types/chat-items'
import { isMessage } from './types/chat-items'
import { ChatroomContextValue, ChatroomVariant, DialogConfig } from './types/chatroom.types'
import type { AnchorKind } from './utils/messageWindow'
import { openComposerSignIn } from './utils/openComposerSignIn'

const ChatroomContext = createContext<ChatroomContextValue | null>(null)

export const useChatroomContext = () => {
  const context = useContext(ChatroomContext)
  if (!context) {
    throw new Error('useChatroomContext must be used within a Chatroom component')
  }
  return context
}

export const ChatroomProvider: React.FC<{
  channelId: string
  variant: keyof ChatroomVariant
  deepLinkMessageId?: string | null
  children: React.ReactNode
}> = ({ channelId, variant, deepLinkMessageId = null, children }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogContent, setDialogContent] = useState<React.ReactNode>(null)
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({})

  const listRef = useRef<VirtuosoMessageListMethods<ChatItem, unknown> | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const [hasMention, setHasMention] = useState(false)

  const profile = useAuthStore((s) => s.profile)
  const currentUserId = (profile as any)?.id ?? null
  const currentUsername = (profile as any)?.username ?? null

  // Persisted unread for this channel, updated by the channel_members
  // realtime subscription in useCatchUserPresences and by SQL trigger +
  // advance_read_cursor (which now decrements it). Mirrors the value the
  // TOC chat-icon UnreadBadge renders, so the jump-to-present chip and
  // the TOC stay in lockstep.
  const unreadCount = useUnreadCount(channelId)

  const anchorKind: AnchorKind = useMemo(
    () => (deepLinkMessageId ? 'message_id' : 'first_unread'),
    [deepLinkMessageId]
  )

  const { error: metadataError, isChannelDataLoaded } = useChannelMetadata(channelId)
  const advanceRef = useRef<(idx: number) => void>(() => {})
  const lastOptimisticSeqRef = useRef<number>(0)
  const onInitialVisible = useCallback((idx: number) => advanceRef.current(idx), [])
  const {
    oldestSeqRef,
    newestSeqRef,
    dataIncludesTailRef,
    loadOlder,
    hasMoreOlder,
    setHasMoreOlder,
    loadingOlder,
    loadNewer,
    loadingNewer
  } = useChannelMessages({
    channelId,
    listRef,
    anchorKind,
    anchorValue: deepLinkMessageId,
    onInitialVisible
  })

  const handleBufferedArrival = useCallback((delta: BufferedArrival) => {
    setNewCount((n) => n + delta.count)
    if (delta.hasMention) setHasMention(true)
  }, [])

  useChannelRealtime({
    channelId,
    listRef,
    newestSeqRef,
    dataIncludesTailRef,
    currentUserId,
    currentUsername,
    onBufferedArrival: handleBufferedArrival
  })

  const { advance } = useReadCursor(channelId)
  const windowSeqRefs = useMemo(
    () => ({
      oldestSeqRef,
      newestSeqRef,
      dataIncludesTailRef,
      setHasMoreOlder
    }),
    [oldestSeqRef, newestSeqRef, dataIncludesTailRef, setHasMoreOlder]
  )
  const scrollToMessage = useScrollToMessage(channelId, listRef, windowSeqRefs)
  const jumpTo = useJumpTo(channelId, listRef, windowSeqRefs)
  const { flash } = useMessageHighlight()

  useEffect(() => {
    if (!deepLinkMessageId) return
    const t = window.setTimeout(() => flash(deepLinkMessageId), 250)
    return () => window.clearTimeout(t)
  }, [deepLinkMessageId, flash])

  useEffect(() => {
    return () => {
      useChatStore.getState().clearOptimisticUnread(channelId)
      useChatStore.getState().clearPeerReadSeq(channelId)
      lastOptimisticSeqRef.current = 0
    }
  }, [channelId])

  // Seed lastOptimisticSeq from the user's persisted read cursor once channel
  // data is loaded. Without this seed, the first onLastVisibleIndexChange walk
  // counts every message in the loaded window as "newly crossed" and
  // decrements unread by the entire window — opening a chatroom with many
  // unread would instantly zero the count instead of decrementing per scroll.
  useEffect(() => {
    if (!isChannelDataLoaded || !currentUserId) return
    if (lastOptimisticSeqRef.current > 0) return
    const member = useChatStore.getState().channelMembers.get(channelId)?.get(currentUserId)
    const lastReadSeq = (member as { last_read_seq?: number } | undefined)?.last_read_seq ?? 0
    if (lastReadSeq > 0) lastOptimisticSeqRef.current = lastReadSeq
  }, [channelId, currentUserId, isChannelDataLoaded])

  const snapToPresent = useCallback(async () => {
    setNewCount(0)
    setHasMention(false)
    await jumpTo({ mode: 'present' })
  }, [jumpTo])

  const onAuthRequired = useCallback(() => {
    openComposerSignIn(channelId)
  }, [channelId])

  const { send, retry } = useSendMessage({
    channelId,
    listRef,
    dataIncludesTailRef,
    snapToPresent,
    onAuthRequired
  })

  // AtBottomTracker fires `true` when the user is parked at the live
  // tail. `newestSeqRef` tracks max seq across fetches + realtime, so it
  // can outrun what's rendered when `dataIncludesTailRef === false`
  // (deep-link mid-history; arrivals land in the detached buffer); only
  // advance when the loaded window actually includes the tail.
  const onAtBottomChange = useCallback(
    (b: boolean) => {
      setAtBottom(b)
      if (!b) return
      if (!dataIncludesTailRef.current) return
      const maxSeq = newestSeqRef.current ?? 0
      if (maxSeq <= 0) return
      advance(maxSeq, 'sent')
      // Tail snap: at-bottom means everything's been seen. Drop optimistic
      // unread immediately for the Telegram-style "click-and-clear" feel
      // rather than waiting on the realtime UPDATE round-trip.
      useChatStore.getState().setOptimisticUnread(channelId, 0)
      lastOptimisticSeqRef.current = maxSeq
    },
    [advance, channelId, newestSeqRef, dataIncludesTailRef]
  )

  // Viewport-driven advance: when the user scrolls (or items first render)
  // Virtuoso reports the bottom-most fully-visible item via
  // `LastVisibleTracker`. We walk backwards from that index to find the
  // most recent sent message — `lastVisibleItemIndex` can point at a
  // `day` or `unread` sentinel which has no seq. `advance` is monotonic,
  // so spamming on every scroll tick is safe.
  const onLastVisibleIndexChange = useCallback(
    (index: number) => {
      const items = listRef.current?.data.get()
      if (!items || index < 0 || index >= items.length) return
      for (let i = index; i >= 0; i--) {
        const it = items[i]
        if (!isMessage(it)) continue
        if (it.status !== 'sent' || typeof it.seq !== 'number') continue
        // Optimistic decrement: walk backward counting sent messages with
        // seq in (lastOptimisticSeq, newSeq]. Early-break once we cross
        // back into the previously-counted region. Messages are appended
        // in seq order so this is O(crossed), not O(items).
        const newSeq = it.seq
        if (newSeq > lastOptimisticSeqRef.current) {
          let crossed = 0
          for (let j = i; j >= 0; j--) {
            const item = items[j]
            if (!isMessage(item)) continue
            if (item.status !== 'sent' || typeof item.seq !== 'number') continue
            if (item.seq <= lastOptimisticSeqRef.current) break
            crossed++
          }
          if (crossed > 0) {
            const seed = useChatStore.getState().channels.get(channelId)?.unread_message_count ?? 0
            useChatStore.getState().decrementOptimisticUnread(channelId, crossed, seed)
          }
          lastOptimisticSeqRef.current = newSeq
        }
        advance(it.seq, 'sent')
        return
      }
    },
    [advance, channelId]
  )
  // Stable bridge: `useChannelMessages.onInitialVisible` is the rAF-polled
  // post-replace seed and must not re-trigger the fetch effect when
  // `advance` / `onLastVisibleIndexChange` rotate. Mutating the ref in an
  // effect (not during render) keeps it React-rules-compliant.
  useEffect(() => {
    advanceRef.current = onLastVisibleIndexChange
  }, [onLastVisibleIndexChange])

  const openDialog = useCallback((content: React.ReactNode, config: DialogConfig = {}) => {
    setDialogContent(content)
    setDialogConfig(config)
    setIsDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
    setDialogContent(null)
    setDialogConfig({})
  }, [])

  // E2E test API: exposed only when NEXT_PUBLIC_E2E=true so production
  // bundles don't surface internals on `window`.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== 'true') return
    ;(window as any).__chatTestApi = {
      scrollToItem: (id: string, align?: any, behavior?: any) => {
        const idx = listRef.current?.data.findIndex((i) => isMessage(i) && i.id === id)
        if (typeof idx !== 'number' || idx < 0) return
        listRef.current?.scrollToItem({
          index: idx,
          align: align ?? 'center',
          behavior: behavior ?? 'instant'
        })
      },
      currentTailSeq: () => newestSeqRef.current,
      lastSeenSeq: () => newestSeqRef.current,
      jumpToPresent: () => {
        snapToPresent()
      }
    }
    return () => {
      delete (window as any).__chatTestApi
    }
  }, [newestSeqRef, snapToPresent])

  const errorMsg = metadataError
    ? metadataError instanceof Error
      ? metadataError.message
      : String(metadataError)
    : null

  // v1 `initLoadMessages` mapped to "data still loading"; v2 reads the
  // single metadata-loaded flag plus dataIncludesTailRef readiness.
  const initLoadMessages = !isChannelDataLoaded

  const value = useMemo<ChatroomContextValue>(
    () => ({
      channelId,
      variant,
      error: errorMsg,
      isChannelDataLoaded,
      openDialog,
      closeDialog,
      isDialogOpen,
      initLoadMessages,
      listRef,
      send,
      retry,
      scrollToMessage,
      jumpTo,
      snapToPresent,
      atBottom,
      newCount,
      hasMention,
      unreadCount,
      onAtBottomChange,
      onLastVisibleIndexChange,
      loadOlder,
      hasMoreOlder,
      loadingOlder,
      loadNewer,
      loadingNewer,
      currentUserId
    }),
    [
      channelId,
      variant,
      errorMsg,
      isChannelDataLoaded,
      openDialog,
      closeDialog,
      isDialogOpen,
      initLoadMessages,
      send,
      retry,
      scrollToMessage,
      jumpTo,
      snapToPresent,
      atBottom,
      newCount,
      hasMention,
      unreadCount,
      onAtBottomChange,
      onLastVisibleIndexChange,
      loadOlder,
      hasMoreOlder,
      loadingOlder,
      loadNewer,
      loadingNewer,
      currentUserId
    ]
  )

  return (
    <ChatroomContext.Provider value={value}>
      {children}
      <Modal open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ModalContent size={dialogConfig.size || 'md'} className={dialogConfig.className}>
          {dialogContent}
        </ModalContent>
      </Modal>
    </ChatroomContext.Provider>
  )
}
