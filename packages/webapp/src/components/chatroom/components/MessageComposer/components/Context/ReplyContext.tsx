import CloseButton from '@components/ui/CloseButton'
import { FaReply } from 'react-icons/fa'

import { useChatroomContext } from '../../../../ChatroomContext'
import { useAutoScrollOnMessageContext } from '../../hooks/useAutoScrollOnMessageContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'

const ReplyContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
  const { replyMessageMemory, setReplyMsgMemory } = useMessageComposer()

  const handleClose = () => {
    setReplyMsgMemory(channelId, null)
    onDismiss?.()
  }

  useAutoScrollOnMessageContext(replyMessageMemory)

  const replyToUser =
    replyMessageMemory?.user_details?.fullname || replyMessageMemory?.user_details?.username || ''

  if (!replyMessageMemory) return null
  if (replyMessageMemory.channel_id !== channelId) return null

  return (
    <div className="text-base-content -mb-1 flex w-full items-center justify-between rounded-t-lg border border-b-0 border-gray-200 px-4 py-2 shadow-[0_-2px_6px_-1px_rgba(0,0,0,0.1)]">
      <FaReply size={24} />
      <div className="text-base-content flex w-full flex-col justify-start pl-3 text-base">
        <span className="text-primary font-semibold antialiased">
          Reply to
          <span className="ml-1 font-normal">{replyToUser}</span>
        </span>
        <span className="text-sm text-wrap break-words wrap-anywhere whitespace-pre-line whitespace-pre-wrap">
          {replyMessageMemory?.content}
        </span>
      </div>
      <CloseButton onClick={handleClose} size="xs" aria-label="Dismiss reply" />
    </div>
  )
}

export default ReplyContext
