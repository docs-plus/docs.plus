import { useAuthStore } from '@stores'
import { Avatar } from './ui/Avatar'

const AvatarStack = ({ users }: any) => {
  const displayedUsers = users?.slice(0, 4)
  const remainingUsers = users.length - 4
  const profile = useAuthStore((state: any) => state.profile)

  console.log({
    users
  })

  return (
    <div className="flex -space-x-4">
      {displayedUsers.map((user: any, index: number) => {
        if (user?.user?.id === profile?.id) return null
        return (
          <div
            key={user.clientId || index}
            className="tooltip tooltip-bottom"
            data-tip={user.user.displayName || 'anonymous'}>
            <Avatar
              className="w-9 h-9 border-2 rounded-full"
              id={user.user?.id}
              src={user.user?.avatar_url}
              alt={user.user.displayName}
            />
          </div>
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
