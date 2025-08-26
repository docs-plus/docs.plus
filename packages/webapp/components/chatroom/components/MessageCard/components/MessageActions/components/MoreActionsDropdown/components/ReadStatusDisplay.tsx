import { useDropdown } from '@components/ui/Dropdown'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { UserReadStatus } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'

type Props = {}
export const ReadStatusDisplay = ({}: Props) => {
  const { isOpen } = useDropdown()
  const { message } = useMessageCardContext()

  if (!message) return null

  return <UserReadStatus message={message} isOpen={isOpen} wrapper="li" avatarLoaderRepeat={4} />
}
