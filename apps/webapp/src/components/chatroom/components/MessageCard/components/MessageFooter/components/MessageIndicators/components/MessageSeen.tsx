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
  // Timestamp already announces a pending or failed send; "Sent" would contradict it.
  const isUnsent = message.status === 'pending' || message.status === 'failed'
  const statusLabel = isSeen ? 'Seen' : isUnsent ? null : 'Sent'

  return (
    <div className={className}>
      {isSeen ? (
        <Icons.checkDouble className="text-primary size-4" aria-hidden />
      ) : (
        <Icons.check className="text-base-content/40 size-4" aria-hidden />
      )}
      {statusLabel ? <span className="sr-only">{statusLabel}</span> : null}
    </div>
  )
}

export default MessageSeen
