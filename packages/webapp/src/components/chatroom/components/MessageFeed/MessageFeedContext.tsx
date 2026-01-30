import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  useAutoScrollForNewMessages,
  useHighlightMessage,
  useInfiniteLoadMessages,
  useScrollAndLoad} from '@components/chatroom/hooks'
import { useChatStore } from '@stores'
import type { Virtualizer } from '@tanstack/react-virtual'
import React, { createContext, useCallback,useContext, useRef } from 'react'

interface MessageFeedContextValue {
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  topSentinelId: string
  bottomSentinelId: string
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
  const registerVirtualizer = useCallback(
    (instance: Virtualizer<HTMLDivElement, HTMLElement> | null) => {
      virtualizerRef.current = instance
    },
    []
  )

  // pagination
  const { isLoadingMore, loadingMoreDirection, topSentinelId, bottomSentinelId } =
    useInfiniteLoadMessages(messageContainerRef)

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

  const value: MessageFeedContextValue = {
    isLoadingMore,
    loadingMoreDirection,
    messageContainerRef,
    topSentinelId,
    bottomSentinelId,
    virtualizerRef,
    registerVirtualizer
  }

  return (
    <MessageFeedContext.Provider value={value} key={channelId}>
      <div className="message-feed-container relative flex size-full h-full flex-col overflow-hidden">
        {children}
      </div>
    </MessageFeedContext.Provider>
  )
}
