import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { useAuthStore } from '@stores'
import { MdOutlineEdit } from 'react-icons/md'

type Props = {}
export const EditAction = ({}: Props) => {
  const { message } = useMessageCardContext()
  const { editMessageHandler } = useEditMessageHandler()
  const user = useAuthStore((state) => state.profile)

  if (user && message?.user_id !== user.id) return null

  return (
    <li>
      <a className="flex items-center gap-2" onClick={() => editMessageHandler(message)}>
        <MdOutlineEdit size={20} />
        Edit Message
      </a>
    </li>
  )
}
