import { useContextMenuContext } from '@components/chatroom/components/ui/ContextMenu'
import { UserReadStatus as UserReadStatusCommon } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import { TMsgRow } from '@types'
import { useMessageLongPressMenu } from '../MessageLongPressMenu'

type Props = {
  message?: TMsgRow | null
}
export const UserReadStatus = ({ message }: Props) => {
  if (!message) return null

  return (
    <UserReadStatusCommon message={message} isOpen={true} wrapper="li" avatarLoaderRepeat={3} />
  )
}
