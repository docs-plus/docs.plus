import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMentionClick, useReadReceipts } from '@components/chatroom/hooks'
import { useAuthStore, useChatStore } from '@stores'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { TMsgRow } from '@types'
import React, { createContext, useContext, useMemo } from 'react'

import { useMessageFeedContext } from '../MessageFeed/MessageFeedContext'

interface MessageListContextValue {
  messages: Map<string, TMsgRow> | undefined
  messagesArray: TMsgRow[]
  channelId: string

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

  const messages = useChatStore((state) => state.messagesByChannel.get(channelId))
  const messagesArray = useMemo<TMsgRow[]>(
    () => (messages ? Array.from(messages.values()) : []),
    [messages]
  )
  const profile = useAuthStore((s) => s.profile)

  const handleMentionClick = useMentionClick()

  useReadReceipts({ channelId, messages: messagesArray, profile })

  const value = useMemo<MessageListContextValue>(
    () => ({
      messages,
      messagesArray,
      channelId,
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
