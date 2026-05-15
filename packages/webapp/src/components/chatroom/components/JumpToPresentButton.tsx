import Button from '@components/ui/Button'
import UnreadBadge from '@components/ui/UnreadBadge'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'

export type JumpToPresentButtonProps = {
  atBottom: boolean
  onTap: () => void
  /** Session-local count of arrivals while scrolled away from the tail. */
  newCount: number
  /** Persisted unread count from channel_members.unread_message_count. */
  unreadCount: number
  hasMention?: boolean
}

/**
 * Telegram-style jump-to-present chip: blue circle with a chevron and a
 * count badge on top. The badge is hidden for anon viewers — they have
 * no per-user read cursor, and `unread_message_count` is repurposed as
 * a channel-activity hint (see AGENTS.md §Anonymous Chat Read Path), so
 * surfacing it as "you have X unread" is misleading. The chip itself
 * stays — anon viewers still benefit from a scroll-to-bottom affordance.
 */
export const JumpToPresentButton = ({
  atBottom,
  onTap,
  newCount,
  unreadCount,
  hasMention = false
}: JumpToPresentButtonProps) => {
  const isAuthed = !!useAuthStore((state) => state.profile?.id)
  if (atBottom) return null
  const count = Math.max(unreadCount, newCount)
  return (
    <Button
      onClick={onTap}
      onPointerDown={(e) => e.preventDefault()}
      variant="primary"
      shape="circle"
      className="absolute right-2 bottom-3 z-40 transition-all duration-300"
      data-key="jump-to-present"
      data-mention={hasMention ? 'true' : 'false'}
      startIcon={<Icons.chevronDown size={20} className="text-primary-content" />}>
      {isAuthed && (
        <UnreadBadge count={count} size="sm" variant="error" className="absolute -top-1 -right-1" />
      )}
    </Button>
  )
}
