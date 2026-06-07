import { Avatar } from '@components/ui/Avatar'
import { TGroupedMsgRow } from '@types'
import { twMerge } from 'tailwind-merge'

import { useMessageAuthorDetails } from '../../../hooks/useMessageAuthorDetails'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

export const ProfilePic = ({ message }: { message: TGroupedMsgRow }) => {
  const author = useMessageAuthorDetails(message)
  const isGroupStart = message.isGroupStart
  const userId = author?.id ?? message.user_id

  return (
    <div className={isGroupStart ? 'block' : 'hidden'}>
      <Avatar
        src={author?.avatar_url}
        avatarUpdatedAt={author?.avatar_updated_at}
        size="md"
        id={userId}
        alt={author?.username ? `avatar_${author.username}` : `avatar_${userId}`}
      />
    </div>
  )
}

export const UserAvatar = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  return (
    <div className={twMerge('relative flex flex-col items-center space-y-2', className)}>
      <ProfilePic message={message} />
    </div>
  )
}
