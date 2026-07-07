import { backlogCount } from '@components/chatroom/utils/backlogCount'
import Button from '@components/ui/Button'
import UnreadBadge from '@components/ui/UnreadBadge'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { twMerge } from 'tailwind-merge'

export type JumpToPresentButtonProps = {
  atBottom: boolean
  onTap: () => void
  /** Session-local count of arrivals while scrolled away from the tail. */
  newCount: number
  /** Persisted unread count from channel_members.unread_message_count. */
  unreadCount: number
  hasMention?: boolean
  /** When the top new-messages banner is visible, use a neutral chip. */
  subdued?: boolean
}

export const JumpToPresentButton = ({
  atBottom,
  onTap,
  newCount,
  unreadCount,
  hasMention = false,
  subdued = false
}: JumpToPresentButtonProps) => {
  const isAuthed = !!useAuthStore((state) => state.profile?.id)
  if (atBottom) return null
  const count = backlogCount(unreadCount, newCount)
  return (
    <Button
      onClick={onTap}
      onPointerDown={(e) => e.preventDefault()}
      variant={subdued ? 'neutral' : 'primary'}
      shape="circle"
      className={twMerge(
        'absolute right-2 bottom-3 z-40 motion-safe:animate-[doc-region-in_200ms_ease-out_both]',
        subdued && 'bg-base-300 border-base-300 border'
      )}
      data-key="jump-to-present"
      data-mention={hasMention ? 'true' : 'false'}
      startIcon={
        <Icons.chevronDown
          size={20}
          className={subdued ? 'text-base-content' : 'text-primary-content'}
        />
      }>
      {isAuthed && !subdued && (
        <UnreadBadge count={count} size="sm" variant="error" className="absolute -top-1 -right-1" />
      )}
    </Button>
  )
}
