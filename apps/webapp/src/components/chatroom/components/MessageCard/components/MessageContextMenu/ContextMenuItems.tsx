import { MessageActionMenuList } from '@components/chatroom/components/MessageCard/components/MessageActionMenuList'
import { useContextMenuContext } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'

type Props = {
  message?: TMsgRow | null
}

const ContextMenuItems = ({ message }: Props) => {
  const { setIsOpen } = useContextMenuContext()
  if (!message) return null

  return (
    <MessageActionMenuList
      message={message}
      surface="contextMenu"
      onClose={() => setIsOpen(false)}
      includeReaction
    />
  )
}

export default ContextMenuItems
