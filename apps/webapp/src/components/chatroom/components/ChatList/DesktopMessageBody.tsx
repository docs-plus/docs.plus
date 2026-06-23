import { MessageCard } from '@components/chatroom/components/MessageCard/MessageCard'
import type { TGroupedMsgRow } from '@types'

import type { MessageStatus } from '../../../../types/message'
import { MessageHoverMenu } from './MessageHoverMenu'

type Props = {
  index: number
  grouped: TGroupedMsgRow
  compact: boolean
  status?: MessageStatus
  onRetry?: () => void
}

function DesktopMessageFooter({ compact }: { compact: boolean }) {
  const indicators = (
    <MessageCard.Footer.Indicators>
      <MessageCard.Footer.Indicators.ReplyCount />
      <MessageCard.Footer.Indicators.EditedBadge />
    </MessageCard.Footer.Indicators>
  )
  const reactions = (
    <>
      <MessageCard.Footer.Reactions.AddReactionButton />
      <MessageCard.Footer.Reactions.ReactionList />
    </>
  )

  if (compact) {
    return (
      <MessageCard.Footer>
        <MessageCard.Footer.Reactions>
          {reactions}
          <div className="mt-auto ml-auto flex justify-end">{indicators}</div>
        </MessageCard.Footer.Reactions>
      </MessageCard.Footer>
    )
  }

  return (
    <MessageCard.Footer>
      {indicators}
      <MessageCard.Footer.Reactions>{reactions}</MessageCard.Footer.Reactions>
    </MessageCard.Footer>
  )
}

export const DesktopMessageBody = ({ index, grouped, compact, status, onRetry }: Props) => {
  return (
    <MessageCard
      index={index}
      message={grouped}
      compact={compact}
      status={status}
      onRetry={onRetry}>
      <div className="flex w-full items-start gap-2">
        <div className="relative flex w-10 shrink-0 flex-col items-center">
          {!compact ? (
            <MessageCard.Header.UserAvatar />
          ) : (
            <MessageCard.Header className="chat-header pt-0.5">
              <MessageCard.Header.Timestamp />
            </MessageCard.Header>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {!compact && (
            <MessageCard.Header className="flex items-center">
              <MessageCard.Header.Username className="text-sm" />
              <MessageCard.Header.Timestamp className="ml-1" />
            </MessageCard.Header>
          )}
          <div className="!mt-0 flex w-full flex-col overflow-hidden text-[15px] font-normal antialiased">
            <MessageCard.Content>
              <MessageCard.Content.ReplyReference />
              <MessageCard.Content.CommentReference />
            </MessageCard.Content>
            <MessageHoverMenu
              id="message-actions"
              placement="top-end"
              offset={-10}
              className="w-full overflow-auto"
              menu={<MessageCard.Actions.HoverMenu />}>
              <MessageCard.Header.BookmarkIndicator />
              <MessageCard.Content>
                <MessageCard.Content.MessageBody />
              </MessageCard.Content>
              <MessageCard.FailedRow />
              <DesktopMessageFooter compact={compact} />
            </MessageHoverMenu>
          </div>
        </div>
      </div>
    </MessageCard>
  )
}
