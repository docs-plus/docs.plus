import React from 'react'
import { twMerge } from 'tailwind-merge'

import { Avatar } from './ui/Avatar'

type StackUser = {
  id?: string
  avatar_url?: string | null
  avatar_updated_at?: string | number | null
  display_name?: string | null
  status?: string | null
}

type AvatarStackProps = {
  users?: StackUser[]
  size?: number
  tooltipPosition?: string
  showStatus?: boolean
  clickable?: boolean
  maxDisplay?: number
  className?: string
}

const AvatarStack: React.FC<AvatarStackProps> = ({
  users = [],
  size = 9,
  tooltipPosition = 'tooltip-bottom',
  showStatus = false,
  clickable = true,
  maxDisplay = 4,
  className
}) => {
  const safeUsers = Array.isArray(users)
    ? users.filter((user): user is StackUser => Boolean(user))
    : []
  const visibleUsers = safeUsers.slice(0, maxDisplay)
  const remainingUsers = Math.max(safeUsers.length - maxDisplay, 0)

  const groupClassName = twMerge('avatar-group -space-x-5', className)
  const tooltipClasses = tooltipPosition ? `tooltip ${tooltipPosition}` : undefined
  const sizeClass = `size-${size}`

  return (
    <div className={groupClassName}>
      {visibleUsers.map((user, index) => (
        <Avatar
          key={user?.id ?? `avatar-${index}`}
          avatarUpdatedAt={user?.avatar_updated_at}
          className={twMerge('bg-gray-300 shadow-xl', sizeClass, tooltipClasses)}
          data-tip={user?.display_name || 'Anonymous'}
          id={user?.id}
          src={user?.avatar_url ?? undefined}
          alt={user?.display_name ?? undefined}
          status={showStatus ? user?.status ?? undefined : undefined}
          clickable={clickable}
        />
      ))}

      {remainingUsers > 0 && (
        <div className={twMerge('avatar avatar-placeholder border', sizeClass)}>
          <div className={twMerge('bg-neutral text-neutral-content text-sm', sizeClass)}>
            +{remainingUsers}
          </div>
        </div>
      )}
    </div>
  )
}

export default AvatarStack
