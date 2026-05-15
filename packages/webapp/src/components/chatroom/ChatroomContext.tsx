import { Modal, ModalContent } from '@components/ui/Dialog'
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

import { type AnchorKind, useChannelMessages } from './hooks/useChannelMessages'
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
  const unreadCount = useChatStore((s) => s.channels.get(channelId)?.unread_message_count ?? 0)

  const anchorKind: AnchorKind = useMemo(
    () => (deepLinkMessageId ? 'message_id' : 'first_unread'),
    [deepLinkMessageId]
  )

  const { error: metadataError, isChannelDataLoaded } = useChannelMetadata(channelId)
  const advanceRef = useRef<(idx: number) => void>(() => {})
  const onInitialVisible = useCallback((idx: number) => advanceRef.current(idx), [])
  const { newestSeqRef, dataIncludesTailRef, loadOlder, hasMoreOlder, loadingOlder } =
    useChannelMessages({
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
  const scrollToMessage = useScrollToMessage(channelId, listRef, dataIncludesTailRef)
  const jumpTo = useJumpTo(channelId, listRef, dataIncludesTailRef)
  const { flash } = useMessageHighlight()

  useEffect(() => {
    if (!deepLinkMessageId) return
    const t = window.setTimeout(() => flash(deepLinkMessageId), 250)
    return () => window.clearTimeout(t)
  }, [deepLinkMessageId, flash])

  const snapToPresent = useCallback(async () => {
    setNewCount(0)
    setHasMention(false)
    await jumpTo({ mode: 'present' })
  }, [jumpTo])

  const onAuthRequired = useCallback(() => {
    // Mirrors v1 SignInToJoinChannel.openSignInModalHandler — there is no
    // central modal API; the global "btn_signin" element opens the auth
    // sheet. Anon writes that hit this path get the same UX as channel-join.
    const url = new URL(window.location.href)
    url.searchParams.set('open_heading_chat', channelId)
    window.history.pushState({}, '', url.href)
    document.getElementById('btn_signin')?.click()
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
      if (maxSeq > 0) advance(maxSeq, 'sent')
    },
    [advance, newestSeqRef, dataIncludesTailRef]
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
        advance(it.seq, 'sent')
        return
      }
    },
    [advance]
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
