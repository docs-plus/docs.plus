import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { messageActionTitle } from '@components/chatroom/components/MessageCard/hooks/messageActionMenu'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useMemo } from 'react'

export const DeleteAction = () => {
  const { message } = useMessageCardContext()
  const profile = useAuthStore((state) => state.profile)
  const { openDialog } = useChatroomContext()

  const isOwner = useMemo(() => {
    return message?.user_id === profile?.id
  }, [message, profile])

  if (!isOwner) return null

  const handleDeleteClick = () => {
    openDialog(<DeleteMessageConfirmationDialog message={message} />, {
      size: 'sm'
    })
  }

  return (
    <MenuItem onClick={handleDeleteClick}>
      <ContextMenuRow icon={<Icons.trash size={16} />} variant="danger">
        {messageActionTitle.delete}
      </ContextMenuRow>
    </MenuItem>
  )
}
