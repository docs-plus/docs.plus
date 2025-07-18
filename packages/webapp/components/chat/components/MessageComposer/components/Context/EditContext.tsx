import { useChannel } from '@components/chat/context/ChannelProvider'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { RiPencilFill } from 'react-icons/ri'
import { IoCloseOutline } from 'react-icons/io5'

const EditContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChannel()
  const { setEditMsgMemory, editMessageMemory } = useMessageComposer()

  const replyToUser =
    editMessageMemory?.user_details?.fullname || editMessageMemory?.user_details?.username || ''

  if (!editMessageMemory) return null
  if (editMessageMemory.channel_id !== channelId) return null

  const handleClose = () => {
    setEditMsgMemory(channelId, null)
    onDismiss?.()
  }

  return (
    <div className="text-base-content -mb-1 flex w-full items-center justify-between rounded-t-lg border border-b-0 border-gray-200 px-4 py-2 shadow-[0_-2px_6px_-1px_rgba(0,0,0,0.1)]">
      <RiPencilFill size={24} />
      <div className="text-base-content flex w-full flex-col justify-start pl-3 text-base">
        <span className="text-primary font-semibold antialiased">
          Edite message
          <span className="ml-1 font-normal">{replyToUser}</span>
        </span>
        <span className="text-sm">{editMessageMemory?.content}</span>
      </div>
      <button className="btn btn-square btn-xs h-8 w-8 p-1" onClick={handleClose}>
        <IoCloseOutline size={22} />
      </button>
    </div>
  )
}

export default EditContext
