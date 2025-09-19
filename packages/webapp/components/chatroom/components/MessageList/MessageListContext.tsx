import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react'
import { debounce } from 'lodash'
import { useChatStore } from '@stores'
import { useCheckReadMessage, useMentionClick } from '@components/chatroom/hooks'
import { useMessageFeedContext } from '../MessageFeed/MessageFeedContext'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import type { Virtualizer } from '@tanstack/react-virtual'

interface MessageListContextValue {
  // Message data
  messages: Map<string, any> | null
  messagesArray: any[]
  channelId: string

  // UI State
  isScrollingUp: boolean

  // Refs and handlers
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  handleMentionClick: (e: React.MouseEvent<HTMLDivElement>) => void

  // Loading states (from parent context)
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
  virtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, HTMLElement> | null>
  registerVirtualizer: (instance: Virtualizer<HTMLDivElement, HTMLElement> | null) => void
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
  const {
    isLoadingMore,
    loadingMoreDirection,
    messageContainerRef,
    virtualizerRef,
    registerVirtualizer
  } = useMessageFeedContext()
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const lastScrollTop = useRef(0)

  // Get messages from store
  const messages = useChatStore((state: any) => state.messagesByChannel.get(channelId))
  const messagesArray = useMemo(() => (messages ? Array.from(messages.values()) : []), [messages])

  // Handlers
  const handleMentionClick = useMentionClick()

  // Scroll detection
  useEffect(() => {
    const container = messageContainerRef.current
    if (!container) return

    const handleScroll = debounce(() => {
      const currentScrollTop = container.scrollTop
      setIsScrollingUp(currentScrollTop < lastScrollTop.current)
      lastScrollTop.current = currentScrollTop
    }, 16) // ~60fps

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      handleScroll.cancel()
    }
  }, [])

  // Mark messages as read
  useCheckReadMessage({ channelId, messages })

  const value: MessageListContextValue = {
    messages,
    messagesArray,
    channelId,
    isScrollingUp,
    messageContainerRef,
    handleMentionClick,
    isLoadingMore,
    loadingMoreDirection,
    virtualizerRef,
    registerVirtualizer
  }

  return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}
