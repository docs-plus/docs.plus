import { twMerge } from 'tailwind-merge'
import { Avatar } from './ui/Avatar'

type StackUser = {
  id?: string
  avatar_url?: string | null
  avatar_updated_at?: string | number | null
  display_name?: string | null
  status?: string | null
}

type TooltipPosition = 'tooltip-top' | 'tooltip-bottom' | 'tooltip-left' | 'tooltip-right'

type AvatarStackProps = {
  users?: StackUser[]
  size?: number
  tooltipPosition?: TooltipPosition
  showStatus?: boolean
  clickable?: boolean
  maxDisplay?: number
  className?: string
}

export function AvatarStack({
  users = [],
  size = 9,
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

  const sizeClass = `size-${size}`

  return (
    <div className={twMerge('avatar-group -space-x-5 !overflow-visible', className)}>
      {visibleUsers.map((user, idx) => (
        <Avatar
          key={user.id ?? `avatar-${idx}`}
          id={user.id}
          src={user.avatar_url ?? undefined}
          alt={user.display_name ?? undefined}
          avatarUpdatedAt={user.avatar_updated_at}
          status={showStatus ? (user.status ?? undefined) : undefined}
          clickable={clickable}
          className={twMerge('bg-gray-300 shadow-xl', sizeClass)}
          tooltip={user.display_name || 'Anonymous'}
          tooltipPosition={tooltipPosition}
        />
      ))}

      {remainingCount > 0 && (
        <div className={twMerge('avatar avatar-placeholder border', sizeClass)}>
          <div className={twMerge('bg-neutral text-neutral-content text-sm', sizeClass)}>
            +{remainingCount}
          </div>
        </div>
      )}
    </div>
  )
}

export default AvatarStack
