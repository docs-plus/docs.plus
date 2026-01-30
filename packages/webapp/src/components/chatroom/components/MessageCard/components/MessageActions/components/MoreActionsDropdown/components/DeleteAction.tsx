import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useAuthStore } from '@stores'
import { useMemo } from 'react'
import { MdDeleteOutline } from 'react-icons/md'

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
    <>
      <li className="border-gray-300">
        <a
          className="text-error flex cursor-pointer items-center gap-2"
          onClick={handleDeleteClick}>
          <MdDeleteOutline size={20} />
          Delete Message
        </a>
      </li>
    </>
  )
}
