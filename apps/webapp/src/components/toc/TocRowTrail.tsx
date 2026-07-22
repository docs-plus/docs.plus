import AvatarStack from '@components/AvatarStack'
import { Tooltip } from '@components/ui/Tooltip'
import UnreadBadge from '@components/ui/UnreadBadge'
import { usePresentUsers } from '@hooks/usePresentUsers'
import { useUnreadCount } from '@hooks/useUnreadCount'
import { Icons } from '@icons'
import type { MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'

import { TOC_CLASSES } from './tocClasses'

type TocRowTrailProps = {
  headingId: string
  isActive: boolean
  /** Desktop shows usersPresence; mobile header/rows omit the stack. */
  showPresence?: boolean
  iconSize?: number
  iconClassName?: string
  triggerClassName?: string
  onChatClick: (e: MouseEvent) => void
  tooltipPlacement?: 'top' | 'left'
  maxAvatars?: number
}

/** Heading Chat Surface end-slot: presence (optional) + chat / unread. */
export function TocRowTrail({
  headingId,
  isActive,
  showPresence = false,
  iconSize = 20,
  iconClassName,
  triggerClassName,
  onChatClick,
  tooltipPlacement = 'top',
  maxAvatars = 4
}: TocRowTrailProps) {
  const unreadCount = useUnreadCount(headingId)
  const presentUsers = usePresentUsers(showPresence ? headingId : '')

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {showPresence && presentUsers.length > 0 && (
        <AvatarStack
          maxDisplay={maxAvatars}
          size="sm"
          surface="well"
          users={presentUsers}
          showStatus={true}
          tooltipPosition="left"
        />
      )}
      <Tooltip title="Chat Room" placement={tooltipPlacement}>
        <button
          type="button"
          className={twMerge(
            TOC_CLASSES.chatTrigger,
            'flex items-center justify-center',
            unreadCount <= 0 && 'size-6',
            triggerClassName
          )}
          data-heading-id={headingId}
          onClick={onChatClick}
          aria-label={unreadCount > 0 ? `${unreadCount} unread — open chat` : 'Open chat'}>
          {unreadCount > 0 ? (
            <UnreadBadge count={unreadCount} size="sm" variant="error" />
          ) : (
            <Icons.chatroom
              className={twMerge(iconClassName, isActive && TOC_CLASSES.chatIconActive)}
              size={iconSize}
            />
          )}
        </button>
      </Tooltip>
    </span>
  )
}
