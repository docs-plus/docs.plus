import AvatarStack from '@components/AvatarStack'
import { Tooltip } from '@components/ui/Tooltip'
import type { Profile } from '@types'
import { twMerge } from 'tailwind-merge'

import { chatTriggerAriaLabel, ChatTriggerContent } from './ChatTriggerContent'
import { TOC_CLASSES } from './tocClasses'

type TocRowTrailProps = {
  headingId: string | undefined
  unreadCount: number
  presentUsers?: Profile[]
  isActive: boolean
  iconSize: number
  iconClassName: string
  onChatClick: (e: React.MouseEvent) => void
  tooltipPlacement?: 'top' | 'left'
  maxAvatars?: number
}

/** Menu end-slot: presence then chat (row grid’s last column). */
export function TocRowTrail({
  headingId,
  unreadCount,
  presentUsers = [],
  isActive,
  iconSize,
  iconClassName,
  onChatClick,
  tooltipPlacement = 'top',
  maxAvatars = 4
}: TocRowTrailProps) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {presentUsers.length > 0 && (
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
            unreadCount <= 0 && 'size-6'
          )}
          data-heading-id={headingId}
          onClick={onChatClick}
          aria-label={chatTriggerAriaLabel(unreadCount)}>
          <ChatTriggerContent
            unreadCount={unreadCount}
            iconSize={iconSize}
            iconClassName={twMerge(iconClassName, isActive && TOC_CLASSES.chatIconActive)}
          />
        </button>
      </Tooltip>
    </span>
  )
}
