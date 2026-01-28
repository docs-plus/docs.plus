import { useChatroomContext } from '../../../../ChatroomContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { RiPencilFill } from 'react-icons/ri'
import CloseButton from '@components/ui/CloseButton'

const EditContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
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
        <span className="text-sm text-wrap break-words wrap-anywhere whitespace-pre-line whitespace-pre-wrap">
          {editMessageMemory?.content}
        </span>
      </div>
      <CloseButton onClick={handleClose} size="xs" aria-label="Cancel edit" />
    </div>
  )
}

export default EditContext
