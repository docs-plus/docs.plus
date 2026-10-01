import { messageActionTitle } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useMemo } from 'react'

export const EditAction = () => {
  const { message } = useMessageCardContext()
  const { editMessageHandler } = useEditMessageHandler()
  const profile = useAuthStore((state) => state.profile)

  const isOwner = useMemo(() => {
    return message?.user_id === profile?.id
  }, [message, profile])

  if (!isOwner) return null

  return (
    <MenuItem onClick={() => editMessageHandler(message)}>
      <ContextMenuRow icon={<Icons.edit size={16} />}>{messageActionTitle.edit}</ContextMenuRow>
    </MenuItem>
  )
}
