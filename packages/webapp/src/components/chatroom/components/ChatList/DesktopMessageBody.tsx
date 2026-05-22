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

/**
 * Mirrors the v1 desktop render-prop composition, restoring the per-message
 * hover toolbar that the Virtuoso migration dropped. Compact rows omit the
 * avatar/header chrome but keep the same hover menu surface.
 */
export const DesktopMessageBody = ({ index, grouped, compact, status, onRetry }: Props) => {
  return (
    <MessageCard
      index={index}
      message={grouped}
      compact={compact}
      status={status}
      onRetry={onRetry}>
      <div className="flex w-full items-start gap-2">
        {!compact && (
          <div className="relative flex flex-col items-center space-y-2">
            <MessageCard.Header.UserAvatar />
          </div>
        )}
        {!compact ? (
          <div className="flex w-full flex-col">
            <MessageCard.Header className="flex items-center">
              <MessageCard.Header.Username className="text-sm" />
              <MessageCard.Header.Timestamp className="ml-1" />
            </MessageCard.Header>
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
                <MessageCard.Footer>
                  <MessageCard.Footer.Indicators>
                    <MessageCard.Footer.Indicators.ReplyCount />
                    <MessageCard.Footer.Indicators.EditedBadge />
                  </MessageCard.Footer.Indicators>
                  <MessageCard.Footer.Reactions>
                    <MessageCard.Footer.Reactions.AddReactionButton />
                    <MessageCard.Footer.Reactions.ReactionList />
                  </MessageCard.Footer.Reactions>
                </MessageCard.Footer>
              </MessageHoverMenu>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-row items-center">
            <div className="relative ml-3 flex flex-col items-center space-y-2">
              <MessageCard.Header className="chat-header">
                <MessageCard.Header.Timestamp />
              </MessageCard.Header>
            </div>
            <div className="!mt-0 flex w-full flex-col overflow-hidden pl-2 text-[15px] font-normal antialiased">
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
                <MessageCard.Footer>
                  <MessageCard.Footer.Reactions>
                    <MessageCard.Footer.Reactions.AddReactionButton />
                    <MessageCard.Footer.Reactions.ReactionList />
                    <div className="mt-auto ml-auto flex justify-end">
                      <MessageCard.Footer.Indicators>
                        <MessageCard.Footer.Indicators.ReplyCount />
                        <MessageCard.Footer.Indicators.EditedBadge />
                      </MessageCard.Footer.Indicators>
                    </div>
                  </MessageCard.Footer.Reactions>
                </MessageCard.Footer>
              </MessageHoverMenu>
            </div>
          </div>
        )}
      </div>
    </MessageCard>
  )
}
