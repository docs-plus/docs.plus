import { twMerge } from 'tailwind-merge'
import { Avatar, type AvatarSize } from './ui/Avatar'

type StackUser = {
  id?: string
  avatar_url?: string | null
  avatar_updated_at?: string | number | null
  display_name?: string | null
  status?: string | null
}

type TooltipPosition = 'tooltip-top' | 'tooltip-bottom' | 'tooltip-left' | 'tooltip-right'

interface AvatarStackProps {
  /** Array of user objects to display */
  users?: StackUser[]
  /** Avatar size preset */
  size?: AvatarSize
  /** Tooltip position for each avatar */
  tooltipPosition?: TooltipPosition
  /** Show status indicator on avatars */
  showStatus?: boolean
  /** Enable click to open profile */
  clickable?: boolean
  /** Maximum number of avatars to display before showing +N */
  maxDisplay?: number
  /** Additional classes for the container */
  className?: string
}

/**
 * Size classes for the overflow counter
 * Matches Avatar SIZE_CLASSES
 */
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'size-6', // 24px
  sm: 'size-8', // 32px
  md: 'size-10', // 40px
  lg: 'size-12', // 48px
  xl: 'size-14', // 56px
  '2xl': 'size-16' // 64px
}

/**
 * Negative spacing for avatar overlap based on size
 */
const SPACING_CLASSES: Record<AvatarSize, string> = {
  xs: '-space-x-2',
  sm: '-space-x-3',
  md: '-space-x-4',
  lg: '-space-x-5',
  xl: '-space-x-6',
  '2xl': '-space-x-7'
}

/**
 * Text size for the +N counter based on avatar size
 */
const TEXT_CLASSES: Record<AvatarSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
  '2xl': 'text-lg'
}

/**
 * AvatarStack component for displaying multiple user avatars
 *
 * Features:
 * - Overlapping avatars with consistent spacing
 * - Overflow counter when exceeding maxDisplay
 * - Tooltips showing user names
 * - Consistent styling with design system
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AvatarStack users={users} />
 *
 * // With custom size and max display
 * <AvatarStack users={users} size="lg" maxDisplay={3} />
 *
 * // Non-clickable with status indicators
 * <AvatarStack users={users} clickable={false} showStatus />
 * ```
 */
export function AvatarStack({
  users = [],
  size = 'md',
  tooltipPosition = 'tooltip-bottom',
  showStatus = false,
  clickable = true,
  maxDisplay = 4,
  className
}: AvatarStackProps) {
  // Filter out null/undefined users
  const validUsers = users.filter(Boolean) as StackUser[]

  // Ensure maxDisplay is a positive number
  const limit = Math.max(1, Number(maxDisplay) || 4)
  const visibleUsers = validUsers.slice(0, limit)
  const remainingCount = Math.max(0, validUsers.length - limit)

  const sizeClass = SIZE_CLASSES[size]
  const spacingClass = SPACING_CLASSES[size]
  const textClass = TEXT_CLASSES[size]

  return (
    <div className={twMerge('avatar-group !overflow-visible', spacingClass, className)}>
      {visibleUsers.map((user, idx) => (
        <Avatar
          key={user.id ?? `avatar-${idx}`}
          id={user.id}
          src={user.avatar_url ?? undefined}
          alt={user.display_name ?? undefined}
          avatarUpdatedAt={user.avatar_updated_at}
          status={showStatus ? (user.status ?? undefined) : undefined}
          clickable={clickable}
          size={size}
          className="ring-base-300 bg-base-100 ring-1"
          tooltip={user.display_name || 'Anonymous'}
          tooltipPosition={tooltipPosition}
        />
      ))}

      {remainingCount > 0 && (
        <div
          className={twMerge(
            'avatar avatar-placeholder',
            sizeClass,
            'rounded-full',
            'ring-base-300 ring-1',
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
