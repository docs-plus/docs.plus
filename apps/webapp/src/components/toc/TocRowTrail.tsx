import AvatarStack from '@components/AvatarStack'
import { Tooltip } from '@components/ui/Tooltip'
import type { Profile } from '@types'
import { twMerge } from 'tailwind-merge'

import { chatTriggerAriaLabel, ChatTriggerContent } from './ChatTriggerContent'
import { TOC_CLASSES } from './tocClasses'
import { tocTrailingRailPx } from './utils'

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

/** Chat pinned to a fixed right inset; avatars extend left — keeps every row’s icon on one vertical axis. */
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
  const spacerWidth = tocTrailingRailPx(presentUsers.length, unreadCount)

  return (
    <>
      <div className="shrink-0" style={{ width: spacerWidth }} aria-hidden="true" />
      <div
        className="absolute top-1/2 z-[3] flex -translate-y-1/2 flex-row-reverse items-center gap-1.5"
        style={{ right: 'var(--toc-trail-inset)' }}>
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
        {presentUsers.length > 0 && (
          <AvatarStack
            maxDisplay={maxAvatars}
            size="sm"
            users={presentUsers}
            showStatus={true}
            tooltipPosition="left"
          />
        )}
      </div>
    </>
  )
}
