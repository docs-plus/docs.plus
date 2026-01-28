import { TMsgRow } from '@types'
import { useMessageCardContext } from '../../../MessageCardContext'
import { twMerge } from 'tailwind-merge'
import { Avatar } from '@components/ui/Avatar'

type Props = {
  className?: string
}

export const ProfilePic = ({ message }: { message: TMsgRow }) => {
  const isGroupStart = message.isGroupStart

  return (
    <div className={isGroupStart ? 'block' : 'hidden'}>
      <Avatar
        src={message?.user_details?.avatar_url}
        avatarUpdatedAt={message?.user_details?.avatar_updated_at}
        size="md"
        id={message?.user_details?.id}
        alt={`avatar_${message?.user_details?.id}`}
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
