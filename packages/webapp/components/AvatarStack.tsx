import { useAuthStore } from '@stores'
import { Avatar } from './ui/Avatar'

const AvatarStack = ({ users }: any) => {
  const displayedUsers = users?.slice(0, 4)
  const remainingUsers = users.length - 4
  const profile = useAuthStore((state: any) => state.profile)

  return (
    <div className="flex -space-x-4">
      {displayedUsers.map((user: any, index: number) => {
        if (user?.user?.id === profile?.id) return null
        return (
          <Avatar
            className="rounded-full shadow-xl border w-9 h-9 tooltip tooltip-bottom"
            id={user.user?.id}
            src={user.user?.avatar_url}
            alt={user.user.displayName}
            data-tip={user.user.displayName || 'anonymous'}
          />
        )
      })}

      {remainingUsers > 0 && (
        <a
          className="flex items-center justify-center w-9 h-9 text-xs font-medium text-white bg-gray-700 border-2 border-white rounded-full hover:bg-gray-600 dark:border-gray-800"
          href="#">
          +{remainingUsers}
        </a>
      )}
    </div>
  )
}

export default AvatarStack
