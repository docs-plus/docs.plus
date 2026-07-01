import { useIsMessageHighlighted } from '@components/chatroom/hooks/useMessageHighlight'
import { TGroupedMsgRow } from '@types'
import { memo } from 'react'

import type { MessageStatus } from '../../../../types/message'
import MessageActions from './components/MessageActions'
import MessageContent from './components/MessageContent'
import { MessageFailedRow } from './components/MessageFailedRow'
import MessageFooter from './components/MessageFooter/MessageFooter'
import MessageHeader from './components/MessageHeader'
import { MessageLongPressMenu } from './components/MessageLongPressMenu'
import { MessageCardProvider } from './MessageCardContext'

type Props = {
  children?: React.ReactNode
  index: number
  message: TGroupedMsgRow
  className?: string
  /** 'highlighted' renders inside the long-press portal — interaction handlers are suppressed there. */
  mode?: 'inline' | 'highlighted'
  /** compact suppresses author chrome; status drives the failed/pending overlay. */
  compact?: boolean
  status?: MessageStatus
  onRetry?: () => void
}

// Memoized so realtime UPDATEs flipping list context identity don't
// cascade across every virtualized row. Highlight uses per-id
// useSyncExternalStore so only the flashed card re-renders.
const MessageCardComponent = ({
  children,
  index,
  message,
  className,
  mode = 'inline',
  compact = false,
  status,
  onRetry
}: Props) => {
  const isFlash = useIsMessageHighlighted(message.id)
  return (
    <MessageCardProvider
      message={message}
      index={index}
      className={`${className ?? ''}${isFlash ? 'msg_card--flash' : ''}`}
      mode={mode}>
      {children ?? <DefaultMessageBody compact={compact} status={status} onRetry={onRetry} />}
    </MessageCardProvider>
  )
}

const DefaultMessageBody = ({
  compact,
  status,
  onRetry
}: {
  compact?: boolean
  status?: MessageStatus
  onRetry?: () => void
}) => {
  // Default desktop body without hover-menu chrome; call-sites may self-close
  // `MessageCard` and inject `MobileMessageBody` instead.
  // Dim-while-pending so the pending→sent/failed flip crossfades instead of popping.
  // `pending` exists only on own optimistic rows, so the send rise never plays on
  // history, pagination, or others' arrivals; a retry re-adding it replays (wanted).
  return (
    <div
      className={`relative flex w-full items-start gap-2 transition-opacity duration-[120ms] ease-out ${
        status === 'pending'
          ? 'opacity-70 motion-safe:animate-[msg-send-in_200ms_ease-out_both]'
          : 'opacity-100'
      }`}>
      {!compact && (
        <div className="relative flex flex-col items-center space-y-2">
          <MessageHeader.UserAvatar />
        </div>
      )}
      <div className="flex w-full flex-col">
        {!compact && (
          <MessageHeader className="flex items-center">
            <MessageHeader.Username className="text-sm" />
            <MessageHeader.Timestamp className="ml-1" />
          </MessageHeader>
        )}
        <div className="!mt-0 flex w-full flex-col overflow-hidden text-[15px] font-normal antialiased">
          <MessageContent>
            <MessageContent.ReplyReference />
            <MessageContent.CommentReference />
            <MessageContent.MessageBody />
          </MessageContent>
          <MessageFailedRow />
          <MessageFooter>
            <MessageFooter.Indicators>
              <MessageFooter.Indicators.ReplyCount />
              <MessageFooter.Indicators.EditedBadge />
            </MessageFooter.Indicators>
            <MessageFooter.Reactions>
              <MessageFooter.Reactions.AddReactionButton />
              <MessageFooter.Reactions.ReactionList />
            </MessageFooter.Reactions>
          </MessageFooter>
        </div>
      </div>
      {status !== undefined && status !== 'sent' && (
        <span
          className="pointer-events-none absolute right-2 bottom-1 text-xs"
          data-status={status}>
          {status === 'pending' && <span className="opacity-60">sending…</span>}
          {status === 'failed' && (
            <button className="text-error pointer-events-auto" onClick={onRetry}>
              failed — tap to retry
            </button>
          )}
        </span>
      )}
    </div>
  )
}

export const MessageCard = memo(
  MessageCardComponent,
  (a, b) =>
    a.index === b.index &&
    a.message === b.message &&
    a.mode === b.mode &&
    a.compact === b.compact &&
    a.status === b.status
) as unknown as typeof MessageCardComponent & {
  Actions: typeof MessageActions
  Header: typeof MessageHeader
  Content: typeof MessageContent
  Footer: typeof MessageFooter
  LongPressMenu: typeof MessageLongPressMenu
  FailedRow: typeof MessageFailedRow
}

MessageCard.Actions = MessageActions
MessageCard.Header = MessageHeader
MessageCard.Content = MessageContent
MessageCard.Footer = MessageFooter
MessageCard.LongPressMenu = MessageLongPressMenu
MessageCard.FailedRow = MessageFailedRow
