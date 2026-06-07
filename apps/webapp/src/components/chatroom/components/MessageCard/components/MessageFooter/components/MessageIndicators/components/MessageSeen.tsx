import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { usePeerReadSeq } from '@components/chatroom/hooks'
import { Icons } from '@icons'

type Props = {
  className?: string
}

const MessageSeen = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const { channelId } = useChatroomContext()
  const peerReadSeq = usePeerReadSeq(channelId)

  if (!message?.isOwner) return null
  const isSeen = typeof message.seq === 'number' && message.seq <= peerReadSeq

  return (
    <div className={className}>
      {isSeen ? (
        <Icons.checkDouble className="text-primary size-4" />
      ) : (
        <Icons.check className="text-base-content/40 size-4" />
      )}
    </div>
  )
}

export default MessageSeen
