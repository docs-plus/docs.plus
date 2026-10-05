import { UserReadStatus } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useContextMenuContext } from '@components/ui/ContextMenu'

export const ReadStatusDisplay = () => {
  const { isOpen } = useContextMenuContext()
  const { message } = useMessageCardContext()

  return <UserReadStatus message={message} isOpen={isOpen} />
}
