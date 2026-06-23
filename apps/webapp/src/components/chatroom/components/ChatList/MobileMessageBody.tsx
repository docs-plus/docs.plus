import { MessageCard } from '@components/chatroom/components/MessageCard/MessageCard'
import type { TGroupedMsgRow } from '@types'
import { twMerge } from 'tailwind-merge'

import type { MessageStatus } from '../../../../types/message'

type Props = {
  index: number
  message: TGroupedMsgRow
  compact: boolean
  status?: MessageStatus
  onRetry?: () => void
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
        className="max-w-[90%] min-w-[80%] sm:min-w-[250px]"
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
        <div
          className={twMerge(
            'chat-bubble px-2.5',
            message.isOwner && 'bg-primary/20 before:hidden',
            !message.isGroupStart && 'before:hidden'
          )}>
          <MessageCard.Header.BookmarkIndicator />
          <MessageCard.Header className="chat-header">
            {!message.isOwner && message.isGroupStart && <MessageCard.Header.Username />}
          </MessageCard.Header>
          <MessageCard.Content>
            <MessageCard.Content.ReplyReference />
            <MessageCard.Content.CommentReference />
            <MessageCard.Content.MessageBody />
          </MessageCard.Content>
          <MessageCard.Footer className="chat-footer justify-end">
            <MessageCard.Footer.Reactions>
              <MessageCard.Footer.Reactions.ReactionList />
            </MessageCard.Footer.Reactions>
            <MessageCard.Footer.Indicators className="pr-0">
              <MessageCard.Footer.Indicators.EditedBadge />
              <MessageCard.Footer.Indicators.ReplyCount />
              <MessageCard.Header.Timestamp />
              <MessageCard.Footer.Indicators.MessageSeen />
            </MessageCard.Footer.Indicators>
          </MessageCard.Footer>
        </div>
        <MessageCard.FailedRow className={message.isOwner ? 'self-end pr-2' : 'self-start pl-2'} />
      </MessageCard>
    </MessageCard.LongPressMenu>
  )
}
