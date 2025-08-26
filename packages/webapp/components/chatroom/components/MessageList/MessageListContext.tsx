import React, { createContext, useContext, useState, useRef, useEffect } from 'react'
import { useChatStore } from '@stores'
import { useCheckReadMessage, useMentionClick } from '@components/chatroom/hooks'
import { useMessageFeedContext } from '../MessageFeed/MessageFeedContext'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'

interface MessageListContextValue {
  // Message data
  messages: Map<string, any> | null
  channelId: string

  // UI State
  isScrollingUp: boolean

  // Refs and handlers
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  handleMentionClick: (e: React.MouseEvent<HTMLDivElement>) => void

  // Loading states (from parent context)
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}

type Props = {
  children: React.ReactNode
}

const MessageListContext = createContext<MessageListContextValue | null>(null)

export const useMessageListContext = () => {
  const context = useContext(MessageListContext)
  if (!context) {
    throw new Error('useMessageListContext must be used within MessageList')
  }
  return context
}

export const MessageListProvider = ({ children }: Props) => {
  const { channelId } = useChatroomContext()
  const { isLoadingMore, loadingMoreDirection, messagesEndRef } = useMessageFeedContext()
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const lastScrollTop = useRef(0)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)

  // Get messages from store
  const messages = useChatStore((state: any) => state.messagesByChannel.get(channelId))

  // Handlers
  const handleMentionClick = useMentionClick()

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = messageContainerRef.current?.scrollTop || 0
      setIsScrollingUp(currentScrollTop < lastScrollTop.current)
      lastScrollTop.current = currentScrollTop
    }

    const currentRef = messageContainerRef.current
    currentRef?.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      currentRef?.removeEventListener('scroll', handleScroll)
    }
  }, [messageContainerRef.current, messages])

  // Mark messages as read
  useCheckReadMessage({ channelId, messages })

  const value: MessageListContextValue = {
    messages,
    channelId,
    isScrollingUp,
    messageContainerRef,
    handleMentionClick,
    isLoadingMore,
    loadingMoreDirection,
    messagesEndRef
  }

  return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}
