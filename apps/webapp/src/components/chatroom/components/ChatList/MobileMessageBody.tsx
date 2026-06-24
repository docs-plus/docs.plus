import { MessageCard } from '@components/chatroom/components/MessageCard/MessageCard'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import type { TGroupedMsgRow } from '@types'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

import type { MessageStatus } from '../../../../types/message'

type Props = {
  index: number
  message: TGroupedMsgRow
  compact: boolean
  status?: MessageStatus
  onRetry?: () => void
}

function MobileChatBubble({ message, children }: { message: TGroupedMsgRow; children: ReactNode }) {
  const { messageLayout } = useMessageCardContext()
  const isMediaOnly = messageLayout === 'media-only'
  const isMediaWithCaption = messageLayout === 'media-with-caption'

  return (
    <div
      className={twMerge(
        'chat-bubble',
        isMediaOnly &&
          'max-w-[min(400px,100%)] bg-transparent px-0 py-0 shadow-none before:!hidden',
        isMediaWithCaption && 'px-0 pt-0',
        !isMediaOnly && !isMediaWithCaption && 'px-2.5',
        message.isOwner && !isMediaOnly && 'bg-primary/20 before:hidden',
        !message.isGroupStart && 'before:hidden'
      )}>
      {children}
    </div>
  )
}

function MobileMessageFooter({ children }: { children: ReactNode }) {
  const { messageLayout } = useMessageCardContext()
  const padMediaFooter = messageLayout === 'media-only' || messageLayout === 'media-with-caption'

  return (
    <MessageCard.Footer className={twMerge('chat-footer justify-end', padMediaFooter && 'px-2.5')}>
      {children}
    </MessageCard.Footer>
  )
}

/**
 * v1 mobile chat-bubble composition restored for the v2 Virtuoso feed.
 * daisyUI `chat-end`/`chat-start` come from `MessageCardContext` based on
 * `message.isOwner` + mobile variant; this body owns the bubble chrome.
 */
export const MobileMessageBody = ({ index, message, compact, status, onRetry }: Props) => {
  return (
    <MessageCard.LongPressMenu message={message}>
      <MessageCard
        message={message}
        index={index}
        compact={compact}
        status={status}
        onRetry={onRetry}>
        {!message.isOwner && (
          <div className="chat-image avatar">
            {message.isGroupStart ? (
              <MessageCard.Header.UserAvatar />
            ) : (
              <span className="block size-10" aria-hidden />
            )}
          </div>
        )}
        <MobileChatBubble message={message}>
          <MessageCard.Header.BookmarkIndicator />
          <MessageCard.Header className="chat-header">
            {!message.isOwner && message.isGroupStart && <MessageCard.Header.Username />}
          </MessageCard.Header>
          <MessageCard.Content>
            <MessageCard.Content.ReplyReference />
            <MessageCard.Content.CommentReference />
            <MessageCard.Content.MessageBody />
          </MessageCard.Content>
          <MobileMessageFooter>
            <MessageCard.Footer.Reactions>
              <MessageCard.Footer.Reactions.ReactionList />
            </MessageCard.Footer.Reactions>
            <MessageCard.Footer.Indicators className="pr-0">
              <MessageCard.Footer.Indicators.EditedBadge />
              <MessageCard.Footer.Indicators.ReplyCount />
              <MessageCard.Header.Timestamp />
              <MessageCard.Footer.Indicators.MessageSeen />
            </MessageCard.Footer.Indicators>
          </MobileMessageFooter>
        </MobileChatBubble>
        <MessageCard.FailedRow className={message.isOwner ? 'self-end pr-2' : 'self-start pl-2'} />
      </MessageCard>
    </MessageCard.LongPressMenu>
  )
}
