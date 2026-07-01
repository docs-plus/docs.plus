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
import { flashMessage } from './hooks/useMessageHighlight'
import { useReadCursor } from './hooks/useReadCursor'
import { useScrollToMessage } from './hooks/useScrollToMessage'
import { useSendMessage } from './hooks/useSendMessage'
import type { ChatItem } from './types/chat-items'
import { isMessage } from './types/chat-items'
import { ChatroomContextValue, ChatroomVariant, DialogConfig } from './types/chatroom.types'
import type { ChannelFeedMode } from './utils/channelFeedProjection'
import {
  MESSAGE_FLASH_AFTER_INSTANT_SCROLL_MS,
  scheduleMessageFlash,
  scrollFlashGate
} from './utils/messageJumpTiming'
import type { AnchorKind } from './utils/messageWindow'
import { findMessageItemIndex } from './utils/messageWindow'
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
  const currentUserId = profile?.id ?? null
  const currentUsername = profile?.username ?? null

  // TOC + jump chip share persisted unread via useUnreadCount.
  const unreadCount = useUnreadCount(channelId)

  const anchorKind: AnchorKind = useMemo(
    () => (deepLinkMessageId ? 'message_id' : 'first_unread'),
    [deepLinkMessageId]
  )

  const { error: metadataError, isChannelDataLoaded } = useChannelMetadata(channelId)
  const advanceRef = useRef<(idx: number) => void>(() => {})
  const lastOptimisticSeqRef = useRef<number>(0)
  const onInitialVisible = useCallback((idx: number) => {
    advanceRef.current(idx)
  }, [])
  const onListScrollSettled = useCallback(() => {
    if (!deepLinkMessageId) return
    scheduleMessageFlash(flashMessage, deepLinkMessageId, MESSAGE_FLASH_AFTER_INSTANT_SCROLL_MS)
  }, [deepLinkMessageId])
  const [feedMode, setFeedMode] = useState<ChannelFeedMode>('all')
  const {
    loading: messagesLoading,
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
    onInitialVisible,
    onListScrollSettled,
    feedMode
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
    onBufferedArrival: handleBufferedArrival,
    feedMode
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
  const scrollToMessage = useScrollToMessage(channelId, listRef, windowSeqRefs, flashMessage)
  const jumpTo = useJumpTo(channelId, listRef, windowSeqRefs)

  useEffect(() => () => scrollFlashGate.invalidate(), [channelId, deepLinkMessageId])

  useEffect(() => {
    setFeedMode('all')
  }, [channelId])

  useEffect(() => {
    return () => {
      const store = useChatStore.getState()
      store.clearOptimisticUnread(channelId)
      store.clearPeerReadSeq(channelId)
      // Single-valued suppression is scoped to this mounted channel.
      store.setUnreadSuppressedChannel(null)
      lastOptimisticSeqRef.current = 0
    }
  }, [channelId])

  // Seed from persisted read cursor so the first viewport walk doesn't zero unread.
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
    onAuthRequired,
    feedMode
  })

  // Advance read cursor only when the rendered window includes the live tail.
  const onAtBottomChange = useCallback(
    (b: boolean) => {
      setAtBottom(b)
      if (!b) {
        useChatStore.getState().setUnreadSuppressedChannel(null)
        return
      }
      if (!dataIncludesTailRef.current) return
      useChatStore.getState().setUnreadSuppressedChannel(channelId)
      const maxSeq = newestSeqRef.current ?? 0
      if (maxSeq <= 0) return
      advance(maxSeq, 'sent')
      useChatStore.getState().setOptimisticUnread(channelId, 0)
      lastOptimisticSeqRef.current = maxSeq
    },
    [advance, channelId, newestSeqRef, dataIncludesTailRef]
  )

  const onLastVisibleIndexChange = useCallback(
    (index: number) => {
      const items = listRef.current?.data.get()
      if (!items || index < 0 || index >= items.length) return
      for (let i = index; i >= 0; i--) {
        const it = items[i]
        if (!isMessage(it)) continue
        if (it.status !== 'sent' || typeof it.seq !== 'number') continue
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

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== 'true') return
    ;(window as any).__chatTestApi = {
      scrollToItem: (id: string, align?: any, behavior?: any) => {
        const items = listRef.current?.data.get() ?? []
        const idx = findMessageItemIndex(items, id)
        if (idx < 0) return
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

  let errorMsg: string | null = null
  if (metadataError) {
    errorMsg = metadataError instanceof Error ? metadataError.message : String(metadataError)
  }

  const isFeedReady = isChannelDataLoaded && !messagesLoading && !errorMsg

  const value = useMemo<ChatroomContextValue>(
    () => ({
      channelId,
      variant,
      error: errorMsg,
      isChannelDataLoaded,
      openDialog,
      closeDialog,
      isDialogOpen,
      isFeedReady,
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
      currentUserId,
      feedMode,
      setFeedMode
    }),
    [
      channelId,
      variant,
      errorMsg,
      isChannelDataLoaded,
      isFeedReady,
      openDialog,
      closeDialog,
      isDialogOpen,
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
      currentUserId,
      feedMode
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
