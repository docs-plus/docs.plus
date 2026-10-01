import { MessageActionMenuList } from '@components/chatroom/components/MessageCard/components/MessageActionMenuList'
import type { MessageActionMenuItemId } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useContextMenuContext } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'

type Props = {
  message?: TMsgRow | null
  only?: MessageActionMenuItemId[]
}

const ContextMenuItems = ({ message, only }: Props) => {
  const { setIsOpen } = useContextMenuContext()
  if (!message) return null

  return (
    <MessageActionMenuList
      message={message}
      surface="contextMenu"
      onClose={() => setIsOpen(false)}
      includeReaction
      only={only}
    />
  )
}

export default ContextMenuItems
