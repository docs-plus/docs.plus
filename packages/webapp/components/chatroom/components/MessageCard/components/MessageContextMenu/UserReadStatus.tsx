import { useContextMenuContext } from '@components/chatroom/components/ui/ContextMenu'
import { UserReadStatus as UserReadStatusCommon } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import { TMsgRow } from '@types'

type Props = {
  message?: TMsgRow | null
}
const UserReadStatus = ({ message }: Props) => {
  const { isOpen } = useContextMenuContext()

  if (!message) return null

  return (
    <UserReadStatusCommon
      message={message}
      isOpen={isOpen}
      wrapper="MenuItem"
      avatarLoaderRepeat={3}
    />
  )
}

export default UserReadStatus
