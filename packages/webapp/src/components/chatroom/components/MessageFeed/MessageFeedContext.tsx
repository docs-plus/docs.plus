import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  useAutoScrollForNewMessages,
  useHighlightMessage,
  useInfiniteLoadMessages,
  useScrollAndLoad
} from '@components/chatroom/hooks'
import type { Virtualizer } from '@tanstack/react-virtual'
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'

interface MessageFeedContextValue {
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  topSentinelRef: React.RefObject<HTMLDivElement | null>
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>
  virtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, HTMLElement> | null>
  registerVirtualizer: (instance: Virtualizer<HTMLDivElement, HTMLElement> | null) => void
}

const MessageFeedContext = createContext<MessageFeedContextValue | null>(null)

export const useMessageFeedContext = () => {
  const context = useContext(MessageFeedContext)
  if (!context) {
    throw new Error('useMessageFeedContext must be used within MessageFeed')
  }
  return context
}

export const MessageFeedProvider: React.FC<{
  children: React.ReactNode
  messageContainerRef: React.RefObject<HTMLDivElement | null>
}> = ({ children, messageContainerRef }) => {
  const { channelId } = useChatroomContext()
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, HTMLElement> | null>(null)
  // Sentinels live on refs (not global ids) so a future multi-chatroom
  // mount can't collide on `document.querySelector('#top-sentinel')`.
  const topSentinelRef = useRef<HTMLDivElement | null>(null)
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null)
  const registerVirtualizer = useCallback(
    (instance: Virtualizer<HTMLDivElement, HTMLElement> | null) => {
      virtualizerRef.current = instance
    },
    []
  )

  // pagination
  const { isLoadingMore, loadingMoreDirection } = useInfiniteLoadMessages({
    messageContainerRef,
    topSentinelRef,
    bottomSentinelRef
  })

  useScrollAndLoad({
    messageContainerRef,
    virtualizerRef
  })

  // highlight message in initial load
  const { highlightedMessageExists } = useHighlightMessage({
    messageContainerRef,
    virtualizerRef
  })

  // auto scroll for new messages when user send message or user is close to bottom
  useAutoScrollForNewMessages({
    isLoadingOlderMessages: isLoadingMore,
    highlightedMessageExists,
    virtualizerRef,
    loadingMoreDirection
  })

  const value = useMemo<MessageFeedContextValue>(
    () => ({
      isLoadingMore,
      loadingMoreDirection,
      messageContainerRef,
      topSentinelRef,
      bottomSentinelRef,
      virtualizerRef,
      registerVirtualizer
    }),
    [isLoadingMore, loadingMoreDirection, messageContainerRef, registerVirtualizer]
  )

  return (
    <MessageFeedContext.Provider value={value} key={channelId}>
      <div className="message-feed-container relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </MessageFeedContext.Provider>
  )
}
