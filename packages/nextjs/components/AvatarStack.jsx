import Image from 'next/image'
import { Avatar } from '@icons'

const AvatarStack = ({ users }) => {
  const displayedUsers = users.slice(0, 4)
  const remainingUsers = users.length - 4

  return (
    <div className="flex -space-x-4">
      {displayedUsers.map((user, index) => {
        const userName = user?.user?.name || 'Unknown'
        const userAvatar = user?.user?.avatar || ''

        return (
          <div
            key={user.clientId || index}
            title={userName}
            className="relative border-gray-200  dark:border-gray-800 bg-white rounded-full w-9 h-9">
            {userAvatar ? (
              <Image
                className="w-9 h-9 border-2 rounded-full"
                src={userAvatar}
                alt={`Avatar of ${userName}`}
                fill={true}
                title={userName}
              />
            ) : (
              <div className="w-9 h-9 border-2 flex  justify-center relative align-middle overflow-hidden bg-gray-100 dark:bg-gray-600 rounded-full ">
                <Avatar size={48} fill="#aaa" className="absolute top-[0px] text-gray-400 -left-[4px]" />
              </div>
            )}
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
