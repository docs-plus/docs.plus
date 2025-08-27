import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { IoCheckmarkDoneSharp, IoCheckmarkSharp } from 'react-icons/io5'

type Props = {
  className?: string
}
const MessageSeen = ({ className }: Props) => {
  const { message } = useMessageCardContext()

  if (!message) return null

  return (
    <div className={className}>
      {!message.readed_at ? (
        <IoCheckmarkSharp className="text-base-content size-4 text-gray-400" />
      ) : (
        <IoCheckmarkDoneSharp className="text-base-content text-docsy size-4" />
      )}
    </div>
  )
}

export default MessageSeen
