import UnreadBadge from '@components/ui/UnreadBadge'
import { Icons } from '@icons'

type ChatTriggerContentProps = {
  unreadCount: number
  iconSize: number
  iconClassName?: string
}

export const ChatTriggerContent = ({
  unreadCount,
  iconSize,
  iconClassName
}: ChatTriggerContentProps) =>
  unreadCount > 0 ? (
    <UnreadBadge count={unreadCount} size="sm" variant="error" />
  ) : (
    <Icons.chatroom className={iconClassName} size={iconSize} />
  )

export const chatTriggerAriaLabel = (unreadCount: number) =>
  unreadCount > 0 ? `${unreadCount} unread — open chat` : 'Open chat'
