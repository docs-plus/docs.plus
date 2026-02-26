import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { Icons } from '@icons'

type Props = {
  className?: string
}
const MessageSeen = ({ className }: Props) => {
  const { message } = useMessageCardContext()

  if (!message) return null

  return (
    <div className={className}>
      {!message.readed_at ? (
        <Icons.check className="text-base-content/40 size-4" />
      ) : (
        <Icons.checkDouble className="text-primary size-4" />
      )}
    </div>
  )
}

export default MessageSeen
