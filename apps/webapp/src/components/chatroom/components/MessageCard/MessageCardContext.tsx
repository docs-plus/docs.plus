import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useChatStore } from '@stores'
import { TGroupedMsgRow } from '@types'
import { isOnlyEmoji } from '@utils/index'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

// Stamped on the card DOM: `cardRef.msgId` for imperative walks; `data-msg-id`
// for flash polling scoped to `.message-feed` (avoids long-press portal clones).
export interface MessageCardDesktopElement extends HTMLDivElement {
  msgId?: string
  createdAt?: string | null
  user_id?: string | null
}

interface MessageCardContextValue {
  message: TGroupedMsgRow
  index: number
  isEmojiOnlyMessage: boolean
  isGroupStart: boolean
  cardRef: React.RefObject<MessageCardDesktopElement | null>
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
  mode?: 'inline' | 'highlighted'
}> = ({ message, children, index, className, mode = 'inline' }) => {
  const cardRef = useRef<MessageCardDesktopElement>(null)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const { variant } = useChatroomContext()
  const isHighlighted = mode === 'highlighted'
  const handleDoubleClick = useCallback(() => {
    if (isHighlighted) return
    setReplyMessageMemory(message.channel_id, message)

    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [isHighlighted, message, setReplyMessageMemory])

  const isEmojiOnlyMessage = isOnlyEmoji(message?.content?.trim() || '')
  const isGroupStart = message.isGroupStart

  useEffect(() => {
    if (!cardRef.current) return
    cardRef.current.msgId = message.id
    cardRef.current.createdAt = message.created_at
    cardRef.current.user_id = message.user_id
  }, [message])

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
          // `relative` + `before:` pseudo gives a 3px left-edge accent that
          // fades in on hover with zero layout shift. Pairs with a 4% text-
          // color bg overlay (theme-agnostic) — together they're at the
          // Slack/Linear-equivalent contrast level rather than the previous
          // ~2% which users couldn't perceive as a state change.
          'message-card group/msgcard chat msg_card relative rounded-md px-3',
          'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-md before:bg-transparent before:transition-colors',
          'transition-colors duration-150',
          variant !== 'mobile' && isGroupStart && 'py-1',
          variant !== 'mobile' && !isGroupStart && 'py-0.5',
          variant !== 'mobile' && (message.is_bookmarked || message.bookmark_id)
            ? 'bg-primary/5 hover:bg-primary/10 my-0.5'
            : variant !== 'mobile' &&
                'hover:bg-base-content/[0.04] hover:before:bg-base-content/25',
          variant === 'mobile'
            ? message.isOwner
              ? 'chat-end owner ml-auto'
              : 'chat-start mr-auto'
            : 'w-full',
          variant === 'mobile' && (isGroupStart ? 'mt-1' : 'mt-0.5'),
          className
        )}
        data-mode={mode}
        data-msg-id={message.id}
        data-msg-date={(message.created_at ?? '').slice(0, 10) || undefined}
        onDoubleClick={isHighlighted ? undefined : handleDoubleClick}
        ref={cardRef}>
        {children}
      </div>
    </MessageCardContext.Provider>
  )
}
