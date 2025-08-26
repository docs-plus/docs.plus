import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo
} from 'react'
import { TMsgRow } from '@types'
import { useAuthStore, useChatStore } from '@stores'
import { isOnlyEmoji } from '@utils/index'
import { useMessageListContext } from '../MessageList/MessageListContext'
import { twMerge } from 'tailwind-merge'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { MessageLongPressMenu } from './components/MessageLongPressMenu'
interface MessageCardContextValue {
  message: TMsgRow
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
  message: TMsgRow
  children: React.ReactNode
  index: number
  className?: string
}> = ({ message, children, index, className }) => {
  const cardRef = useRef<MessageCardDesktopElement>(null)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const { messages } = useMessageListContext()
  const { variant } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const handleDoubleClick = useCallback(() => {
    // if (!settings.contextMenue?.reply) return

    setReplyMessageMemory(message.channel_id, message)

    // Trigger editor focus
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [message, /*settings.contextMenue?.reply, */ setReplyMessageMemory])

  const isEmojiOnlyMessage = isOnlyEmoji(message?.content?.trim() || '')
  const isGroupStart = message.isGroupStart

  const isOwnerMessage = useMemo(() => {
    return message.user_id === user?.id
  }, [message.user_id, user?.id])

  // Attach ref and message data to DOM element
  useEffect(() => {
    // if (ref) {
    //   ref.current = cardRef.current
    // }

    if (!cardRef.current) return

    cardRef.current.msgId = message.id
    cardRef.current.readedAt = message.readed_at
    cardRef.current.createdAt = message.created_at
    cardRef.current.user_id = message.user_id
  }, [/*ref,*/ message, cardRef, isOwnerMessage])

  const value: MessageCardContextValue = {
    message,
    index,
    isEmojiOnlyMessage,
    isGroupStart,
    cardRef
  }

  return (
    <MessageCardContext.Provider value={value}>
      <MessageLongPressMenu>
        <div
          className={twMerge(
            'message-card group/msgcard chat msg_card relative rounded-md pl-3 transition-colors',
            variant !== 'mobile' && (message.is_bookmarked || message.bookmark_id)
              ? 'my-1 bg-blue-50 hover:bg-blue-100'
              : variant !== 'mobile' && 'hover:bg-base-200',
            'transition-colors duration-150',
            variant === 'mobile'
              ? isOwnerMessage
                ? 'chat-end owner ml-auto'
                : 'chat-start mr-auto'
              : 'w-full',
            variant === 'mobile' && 'mt-1',
            className
          )}
          onDoubleClick={handleDoubleClick}
          data-message-id={message.id}
          ref={cardRef}>
          {children}
        </div>
      </MessageLongPressMenu>
    </MessageCardContext.Provider>
  )
}
