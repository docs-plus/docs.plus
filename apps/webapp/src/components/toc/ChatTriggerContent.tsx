import UnreadBadge from '@components/ui/UnreadBadge'
import { Icons } from '@icons'

type ChatTriggerContentProps = {
  unreadCount: number
  iconSize: number
  iconClassName?: string
  /** Desktop rail passes a well-colored ring; mobile floors differ, so no default. */
  badgeClassName?: string
}

export const ChatTriggerContent = ({
  unreadCount,
  iconSize,
  iconClassName,
  badgeClassName
}: ChatTriggerContentProps) =>
  unreadCount > 0 ? (
    <UnreadBadge count={unreadCount} size="sm" variant="error" className={badgeClassName} />
  ) : (
    <Icons.chatroom className={iconClassName} size={iconSize} />
  )

export const chatTriggerAriaLabel = (unreadCount: number) =>
  unreadCount > 0 ? `${unreadCount} unread — open chat` : 'Open chat'
