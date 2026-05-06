import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMentionClick, useReadReceipts } from '@components/chatroom/hooks'
import { useAuthStore, useChatStore } from '@stores'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { TGroupedMsgRow, TMsgRow } from '@types'
import { projectMessageGroups } from '@utils/projectMessageGroups'
import React, { createContext, useContext, useMemo } from 'react'

import { useMessageFeedContext } from '../MessageFeed/MessageFeedContext'

interface MessageListContextValue {
  messages: Map<string, TMsgRow> | undefined
  /**
   * Sorted, grouped projection that is the single source of truth for the
   * virtualizer in MessageLoop and the read-receipt scanner in
   * useReadReceipts. Indices into this array correspond 1:1 to virtual
   * items; do NOT pass an unsorted Map.values() array to anything that
   * indexes by `virtualizer.getVirtualItems()[i].index`.
   */
  projectedMessages: TGroupedMsgRow[]
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
  const profile = useAuthStore((s) => s.profile)
  const currentUserId = profile?.id ?? null

  const projectedMessages = useMemo<TGroupedMsgRow[]>(() => {
    if (!messages) return []
    return projectMessageGroups(Array.from(messages.values()), currentUserId)
  }, [messages, currentUserId])

  const handleMentionClick = useMentionClick()

  useReadReceipts({ channelId, messages: projectedMessages, profile })

  const value = useMemo<MessageListContextValue>(
    () => ({
      messages,
      projectedMessages,
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
      projectedMessages,
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
