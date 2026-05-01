import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useChatStore } from '@stores'
import { TGroupedMsgRow } from '@types'
import { isOnlyEmoji } from '@utils/index'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface MessageCardContextValue {
  message: TGroupedMsgRow
  index: number
  isEmojiOnlyMessage: boolean
  isGroupStart: boolean
  cardRef: React.RefObject<MessageCardDesktopElement | null>
}

export interface MessageCardDesktopElement extends HTMLDivElement {
  msgId?: string
  readedAt?: string | null
  createdAt?: string | null
  user_id?: string | null
  isOwner?: boolean
}

const MessageCardContext = createContext<MessageCardContextValue | null>(null)

export const useMessageCardContext = () => {
  const context = useContext(MessageCardContext)
  if (!context) {
    throw new Error('useMessageCardContext must be used within MessageCard')
  }
  return context
}

export const MessageCardProvider: React.FC<{
  message: TGroupedMsgRow
  children: React.ReactNode
  index: number
  className?: string
}> = ({ message, children, index, className }) => {
  const cardRef = useRef<MessageCardDesktopElement>(null)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const { variant } = useChatroomContext()
  const handleDoubleClick = useCallback(() => {
    setReplyMessageMemory(message.channel_id, message)

    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [message, setReplyMessageMemory])

  const isEmojiOnlyMessage = isOnlyEmoji(message?.content?.trim() || '')
  const isGroupStart = message.isGroupStart

  useEffect(() => {
    if (!cardRef.current) return

    cardRef.current.msgId = message.id
    cardRef.current.readedAt = message.readed_at
    cardRef.current.createdAt = message.created_at
    cardRef.current.user_id = message.user_id
  }, [message, cardRef])

  const value = useMemo<MessageCardContextValue>(
    () => ({
      message,
      index,
      isEmojiOnlyMessage,
      isGroupStart,
      cardRef
    }),
    [message, index, isEmojiOnlyMessage, isGroupStart]
  )

  return (
    <MessageCardContext.Provider value={value}>
      <div
        className={twMerge(
          'message-card group/msgcard chat msg_card relative rounded-md pl-3 transition-colors',
          variant !== 'mobile' && (message.is_bookmarked || message.bookmark_id)
            ? 'bg-primary/5 hover:bg-primary/10 my-1'
            : variant !== 'mobile' && 'hover:bg-base-200',
          'transition-colors duration-150',
          variant === 'mobile'
            ? message.isOwner
              ? 'chat-end owner ml-auto'
              : 'chat-start mr-auto'
            : 'w-full',
          variant === 'mobile' && 'mt-1',
          className
        )}
        onDoubleClick={handleDoubleClick}
        ref={cardRef}>
        {children}
      </div>
    </MessageCardContext.Provider>
  )
}
