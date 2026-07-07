import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  deriveMessagePresentation,
  type MessageSurfaceLayout
} from '@components/chatroom/utils/messagePresentation'
import { useChatStore } from '@stores'
import type { MessageMediaItem } from '@types'
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
  medias: MessageMediaItem[]
  hasCaption: boolean
  messageLayout: MessageSurfaceLayout
  messageDisplayType: string
  hasMedia: boolean
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
  const presentation = useMemo(() => deriveMessagePresentation(message), [message])
  const isMobileMediaOnly = variant === 'mobile' && presentation.layout === 'media-only'

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
      cardRef,
      medias: presentation.medias,
      hasCaption: presentation.hasCaption,
      messageLayout: presentation.layout,
      messageDisplayType: presentation.displayType,
      hasMedia: presentation.hasMedia
    }),
    [message, index, isEmojiOnlyMessage, isGroupStart, presentation]
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
          'message-card group/msgcard chat msg_card rounded-field relative',
          'before:rounded-l-field before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-transparent before:transition-colors',
          'transition-colors duration-150',
          // Desktop: every card — text or media — is a full-width, uniformly
          // padded, hoverable row. Media tiles carry their own max-width, so the
          // card stays cohesive with text cards (same hover, left edge, padding).
          variant !== 'mobile' && 'w-full px-3',
          variant !== 'mobile' && (isGroupStart ? 'py-1' : 'py-0.5'),
          variant !== 'mobile' &&
            (message.is_bookmarked || message.bookmark_id
              ? 'bg-primary/5 hover:bg-primary/10 my-0.5'
              : 'hover:bg-base-content/[0.04] hover:before:bg-base-content/25'),
          // Mobile: owner-aligned daisyUI chat bubbles.
          variant === 'mobile' &&
            (message.isOwner ? 'chat-end owner ml-auto' : 'chat-start mr-auto'),
          variant === 'mobile' &&
            (isMobileMediaOnly
              ? 'w-fit max-w-[min(400px,90%)]'
              : 'max-w-[90%] min-w-[80%] sm:min-w-[250px]'),
          variant === 'mobile' && (isGroupStart ? 'mt-1' : 'mt-0.5'),
          className
        )}
        data-mode={mode}
        data-msg-id={message.id}
        data-message-type={presentation.displayType}
        data-message-layout={presentation.layout}
        data-msg-date={(message.created_at ?? '').slice(0, 10) || undefined}
        onDoubleClick={isHighlighted ? undefined : handleDoubleClick}
        ref={cardRef}>
        {children}
      </div>
    </MessageCardContext.Provider>
  )
}
