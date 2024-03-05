import { useAuthStore } from '@stores'
import { Avatar } from './ui/Avatar'

const AvatarStack = ({ users = [], size = 9, tooltipPosition = 'tooltip-bottom' }: any) => {
  const displayedUsers = users?.slice(0, 4)
  const remainingUsers = users.length - 4
  const profile = useAuthStore((state: any) => state.profile)

  return (
    <div className="flex -space-x-4">
      {displayedUsers.map((user: any, index: number) => {
        // if (user?.id === profile?.id) return null
        return (
          <Avatar
            key={index}
            className={`rounded-full shadow-xl border w-${size} h-${size} tooltip  ${tooltipPosition}`}
            id={user?.id}
            src={user?.avatar_url}
            alt={user.displayName}
            data-tip={user.displayName || user.full_nam || user.username || 'anonymous'}
          />
        )
      })}

      {remainingUsers > 0 && (
        <a
          className="flex items-center justify-center w-${size} h-${size} text-xs font-medium text-white bg-gray-700 border-2 border-white rounded-full hover:bg-gray-600 dark:border-gray-800"
          href="#">
          +{remainingUsers}
        </a>
      )}
    </div>
  )
}

export default AvatarStack
