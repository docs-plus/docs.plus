import { ProfilePic } from '@components/chatroom/components/chatContainer/message-parts/ProfilePic'
import { useMessageCardContext } from '../../../MessageCardContext'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}
export const UserAvatar = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  return (
    <div className={twMerge('relative flex flex-col items-center space-y-2', className)}>
      <ProfilePic message={message} />
    </div>
  )
}
