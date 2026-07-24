import { Placement } from '@floating-ui/react'
import { type FaceSource, resolveDisplayName, type StackUser } from '@utils/avatarFace'
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

import { Avatar } from './ui/Avatar'

export type { AvatarStackAnchor, AvatarStackSurface, FaceSource, StackUser }
export { SPACING_CLASSES }

interface AvatarStackProps {
  users?: FaceSource[]
  size?: AvatarSize
  /** Default `paper`. TOC = `well`; PadTitle = `outline`. */
  surface?: AvatarStackSurface
  tooltipPosition?: Placement
  showStatus?: boolean
  clickable?: boolean
  maxDisplay?: number
  /** True total when it exceeds `users.length` — the +N chip counts from this, not the array */
  overflowCount?: number
  /** Fixed edge as the stack grows. `right` pins the right edge (faces extend left). */
  anchor?: AvatarStackAnchor
  className?: string
}

export function AvatarStack({
  users = [],
  size = 'md',
  surface = 'paper',
  tooltipPosition = 'bottom',
  showStatus = false,
  clickable = true,
  maxDisplay = 4,
  overflowCount,
  anchor = 'left',
  className
}: AvatarStackProps) {
  const validUsers = users.filter(Boolean) as FaceSource[]

  const limit = Math.max(1, Number(maxDisplay) || 4)
  const visibleUsers = validUsers.slice(0, limit)
  // When a true total is supplied, count the +N from it minus the faces actually shown.
  const remainingCount =
    overflowCount != null
      ? Math.max(0, overflowCount - visibleUsers.length)
      : Math.max(0, validUsers.length - limit)

  const sizeClass = SIZE_CLASSES[size]
  const spacingClass = SPACING_CLASSES[size]
  const textClass = TEXT_CLASSES[size]
  const edge = stackSurfaceToEdge(surface)
  const edgeClass = avatarEdgeClass(edge)

  // Right anchor: pin the right edge and let faces extend left. Reverse the flow
  // and paint the first (rightmost) face on top so the newest joiner sits behind.
  const anchorRight = anchor === 'right'

  return (
    <div
      className={twMerge(
        'avatar-group !overflow-visible',
        spacingClass,
        anchorRight && 'flex-row-reverse space-x-reverse',
        className
      )}>
      {visibleUsers.map((user, idx) => {
        const displayName = resolveDisplayName(user)

        return (
          <Avatar
            // Keyed by user id so reorders keep DOM nodes; entry animation plays only on join.
            key={user.id ?? user.user_id ?? `avatar-${idx}`}
            face={user}
            status={showStatus ? (user.status ?? undefined) : undefined}
            clickable={clickable}
            size={size}
            edge={edge}
            className="bg-base-100 animate-badge-entry"
            style={anchorRight ? { zIndex: visibleUsers.length - idx } : undefined}
            tooltip={displayName || 'Anonymous'}
            tooltipPosition={tooltipPosition}
          />
        )
      })}

      {remainingCount > 0 && (
        <div
          style={anchorRight ? { zIndex: 0 } : undefined}
          className={twMerge(
            'avatar avatar-placeholder',
            sizeClass,
            'rounded-full',
            edgeClass,
            'bg-base-100'
          )}>
          <div
            className={twMerge(
              sizeClass,
              'flex items-center justify-center',
              'rounded-full',
              'bg-neutral text-neutral-content',
              'font-semibold',
              textClass
            )}>
            +{remainingCount}
          </div>
        </div>
      )}
    </div>
  )
}

export default AvatarStack
