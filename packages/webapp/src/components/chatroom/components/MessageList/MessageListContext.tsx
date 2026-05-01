import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useCheckReadMessage, useMentionClick } from '@components/chatroom/hooks'
import { useChatStore } from '@stores'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { TMsgRow } from '@types'
import debounce from 'lodash/debounce'
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useMessageFeedContext } from '../MessageFeed/MessageFeedContext'

interface MessageListContextValue {
  messages: Map<string, TMsgRow> | undefined
  messagesArray: TMsgRow[]
  channelId: string

  isScrollingUp: boolean

  messageContainerRef: React.RefObject<HTMLDivElement | null>
  handleMentionClick: (e: React.MouseEvent<HTMLDivElement>) => void

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

  const messages = useChatStore((state) => state.messagesByChannel.get(channelId))
  const messagesArray = useMemo<TMsgRow[]>(
    () => (messages ? Array.from(messages.values()) : []),
    [messages]
  )

  const handleMentionClick = useMentionClick()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useCheckReadMessage({ channelId, messages: messages ?? null })

  const value = useMemo<MessageListContextValue>(
    () => ({
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
    }),
    [
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
    ]
  )

  return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}
