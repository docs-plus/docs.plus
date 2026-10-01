import { messageActionTitle } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
import { Icons } from '@icons'

export const CopyToDocAction = () => {
  const { copyMessageToDocHandler } = useCopyMessageToDocHandler()
  const { message } = useMessageCardContext()

  if (!message) return null

  return (
    <MenuItem onClick={() => copyMessageToDocHandler(message)}>
      <ContextMenuRow icon={<Icons.fileOpen size={16} />}>
        {messageActionTitle.copyToDoc}
      </ContextMenuRow>
    </MenuItem>
  )
}
