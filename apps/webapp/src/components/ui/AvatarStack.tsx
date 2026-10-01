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
import { twMerge } from '@utils/twMerge'

import { Avatar, type AvatarActivity } from './Avatar'

const ACTIVITY_TOOLTIPS: Record<AvatarActivity, string> = {
  typing: 'is typing',
  choosingEmoji: 'is choosing an emoji',
  recordingVoice: 'is recording a voice note'
}

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
  /** Show what each face is doing now: a chip for an activity, else the typing bounce. */
  showActivity?: boolean
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
  showActivity = false,
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
        const name = displayName || 'Anonymous'
        const typing = user.status === 'TYPING' ? 'typing' : undefined
        const activity = showActivity ? (user.activity ?? typing) : undefined
        // The chip sits top-right, so a chip face paints above the face on its right.
        // Right anchor: that face comes earlier in the DOM, so a tie is already right.
        let zIndex = anchorRight ? visibleUsers.length - index : undefined
        if (activity && activity !== 'typing') {
          zIndex = visibleUsers.length + 1 - (anchorRight ? 0 : index)
        }
        return (
          <Avatar
            key={id ?? `face-${index}`}
            face={user}
            size={size}
            edge={edge}
            clickable={clickable}
            activity={activity}
            tooltip={activity ? `${name} ${ACTIVITY_TOOLTIPS[activity]}` : name}
            tooltipPlacement={tooltipPlacement}
            className="animate-badge-entry"
            style={zIndex === undefined ? undefined : { zIndex }}
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
          style={{ zIndex: visibleUsers.length + 2 }}>
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
