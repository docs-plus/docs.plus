import { Placement } from '@floating-ui/react'
import { type FaceSource, resolveFace } from '@utils/avatarFace'
import {
  avatarEdgeClass,
  type AvatarSize,
  type AvatarStackAnchor,
  type AvatarStackSurface,
  SIZE_CLASSES,
  SPACING_CLASSES,
  stackSurfaceToEdge,
  TEXT_CLASSES
} from '@utils/avatarStackGeometry'
import { twMerge } from 'tailwind-merge'

import { Avatar } from './Avatar'

export interface AvatarStackProps {
  users?: FaceSource[]
  size?: AvatarSize
  /** Surface the stack sits on; picks the cutout color. */
  surface?: AvatarStackSurface
  /** Faces rendered before the rest collapse into the +N chip. */
  maxDisplay?: number
  /** Full population when it exceeds `users.length` — the +N chip counts from this. */
  totalCount?: number
  /** Which edge stays put as the stack grows. */
  anchor?: AvatarStackAnchor
  /** Bounce faces whose owner is currently typing. */
  showTypingIndicator?: boolean
  clickable?: boolean
  tooltipPlacement?: Placement
  className?: string
}

export function AvatarStack({
  users = [],
  size = 'md',
  surface = 'paper',
  maxDisplay = 4,
  totalCount,
  anchor = 'left',
  showTypingIndicator = false,
  clickable = true,
  tooltipPlacement = 'bottom',
  className
}: AvatarStackProps) {
  const visibleUsers = users.slice(0, maxDisplay)
  const remainingCount = Math.max(0, (totalCount ?? users.length) - visibleUsers.length)

  const edge = stackSurfaceToEdge(surface)
  // Right anchor reverses the row and paints the first face on top, so the stack
  // grows leftwards and its right edge never moves.
  const anchorRight = anchor === 'right'

  if (visibleUsers.length === 0 && remainingCount === 0) return null

  return (
    <div
      className={twMerge(
        'avatar-group !overflow-visible',
        SPACING_CLASSES[size],
        anchorRight && 'flex-row-reverse space-x-reverse',
        className
      )}>
      {visibleUsers.map((user, index) => {
        const { id, displayName } = resolveFace(user)
        return (
          <Avatar
            key={id ?? `face-${index}`}
            face={user}
            size={size}
            edge={edge}
            clickable={clickable}
            isTyping={showTypingIndicator && user.status === 'TYPING'}
            tooltip={displayName || 'Anonymous'}
            tooltipPlacement={tooltipPlacement}
            className="animate-badge-entry"
            style={anchorRight ? { zIndex: visibleUsers.length - index } : undefined}
          />
        )
      })}

      {remainingCount > 0 && (
        <div
          className={twMerge(
            'avatar avatar-placeholder animate-badge-entry rounded-full',
            SIZE_CLASSES[size],
            avatarEdgeClass(edge)
          )}
          // The count is data, not a face: keep it above the pile in both anchors.
          style={anchorRight ? { zIndex: visibleUsers.length + 1 } : undefined}>
          <div
            className={twMerge(
              'bg-neutral text-neutral-content flex size-full items-center justify-center rounded-full font-semibold',
              TEXT_CLASSES[size]
            )}>
            +{remainingCount}
          </div>
        </div>
      )}
    </div>
  )
}
