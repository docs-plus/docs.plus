import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { useAuthStore } from '@stores'
import { useMemo } from 'react'
import { MdOutlineEdit } from 'react-icons/md'

type Props = {}
export const EditAction = ({}: Props) => {
  const { message } = useMessageCardContext()
  const { editMessageHandler } = useEditMessageHandler()
  const profile = useAuthStore((state) => state.profile)

  const isOwner = useMemo(() => {
    return message?.user_id === profile?.id
  }, [message, profile])

  if (!isOwner) return null

  return (
    <li>
      <a className="flex items-center gap-2" onClick={() => editMessageHandler(message)}>
        <MdOutlineEdit size={20} />
        Edit Message
      </a>
    </li>
  )
}
