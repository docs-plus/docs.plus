import React, { createContext, useContext } from 'react'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  useScrollAndLoad,
  useInfiniteLoadMessages,
  useAutoScrollForNewMessages,
  useHighlightMessage
} from '@components/chatroom/hooks'

interface MessageFeedContextValue {
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  topSentinelId: string
  bottomSentinelId: string
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

  // pagination
  const { isLoadingMore, loadingMoreDirection, topSentinelId, bottomSentinelId } =
    useInfiniteLoadMessages(messageContainerRef)

  const { messagesEndRef } = useScrollAndLoad(messageContainerRef)

  // highlight message in initial load
  const { highlightedMessageExists } = useHighlightMessage({
    messageContainerRef
  })

  // auto scroll for new messages when user send message or user is close to bottom
  useAutoScrollForNewMessages({
    isLoadingOlderMessages: isLoadingMore,
    messageContainerRef,
    highlightedMessageExists
  })

  const value: MessageFeedContextValue = {
    messagesEndRef,
    isLoadingMore,
    loadingMoreDirection,
    messageContainerRef,
    topSentinelId,
    bottomSentinelId
  }

  return (
    <MessageFeedContext.Provider value={value} key={channelId}>
      <div className="message-feed-container relative flex size-full h-full flex-col overflow-hidden">
        {children}
      </div>
    </MessageFeedContext.Provider>
  )
}
