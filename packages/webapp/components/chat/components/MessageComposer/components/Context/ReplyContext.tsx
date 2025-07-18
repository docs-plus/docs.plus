import { useChannel } from '@components/chat/context/ChannelProvider'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { FaReply } from 'react-icons/fa'
import { IoCloseSharp } from 'react-icons/io5'

const ReplyContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChannel()
  const { replyMessageMemory, setReplyMsgMemory } = useMessageComposer()

  const handleClose = () => {
    setReplyMsgMemory(channelId, null)
    onDismiss?.()
  }

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
        <span className="text-sm">{replyMessageMemory?.content}</span>
      </div>
      <button className="btn btn-square btn-xs h-8 w-8 p-1" onClick={handleClose}>
        <IoCloseSharp size={22} />
      </button>
    </div>
  )
}

export default ReplyContext
