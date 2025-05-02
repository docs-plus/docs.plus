// import { useAuthStore } from '@stores'
import { Avatar } from './ui/Avatar'

const AvatarStack = ({
  users = [],
  size = 9,
  tooltipPosition = 'tooltip-bottom',
  showStatus = false
}: any) => {
  const displayedUsers = users?.slice(0, 4)
  const remainingUsers = users.length - 4
  // const profile = useAuthStore((state: any) => state.profile)

  return (
    <div className="avatar-group -space-x-5">
      {displayedUsers.map((user: any, index: number) => {
        // if (user?.id === profile?.id) return null
        return (
          <Avatar
            key={index}
            avatarUpdatedAt={user?.avatar_updated_at}
            className={`rounded-full border border-gray-300 shadow-xl${size} size-${size} tooltip ${tooltipPosition}`}
            id={user?.id}
            src={user?.avatar_url}
            alt={user.display_name}
            data-tip={user.display_name || 'anonymous'}
            status={showStatus ? user?.status : undefined}
          />
        )
      })}

      {remainingUsers > 0 && (
        <a
          className="w-${size} h-${size} z-10 flex items-center justify-center rounded-full border-1 border-white bg-gray-700 text-xs font-medium text-white hover:bg-gray-600"
          href="#">
          +{remainingUsers}
        </a>
      )}
    </div>
  )
}

export default AvatarStack
