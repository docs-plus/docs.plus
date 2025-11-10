import { UserReadStatus as UserReadStatusCommon } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import { TMsgRow } from '@types'

type Props = {
  message?: TMsgRow | null
  className?: string
}
export const UserReadStatus = ({ message, className }: Props) => {
  if (!message) return null

  return (
    <UserReadStatusCommon
      message={message}
      isOpen={true}
      wrapper="li"
      avatarLoaderRepeat={3}
      className={className}
    />
  )
}
