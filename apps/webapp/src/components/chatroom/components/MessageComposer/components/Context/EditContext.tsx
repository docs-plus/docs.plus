import { Icons } from '@icons'

import { useChatroomContext } from '../../../../ChatroomContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useScrollFeedOnContextOpen } from '../../hooks/useScrollFeedOnContextOpen'
import { MessageContextBar } from './MessageContextBar'

const EditContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
  const { setEditMsgMemory, editMessageMemory } = useMessageComposer()

  useScrollFeedOnContextOpen(editMessageMemory)

  const handleClose = () => {
    setEditMsgMemory(channelId, null)
    onDismiss?.()
  }

  if (!editMessageMemory || editMessageMemory.channel_id !== channelId) return null

  const author =
    editMessageMemory.user_details?.fullname?.trim() ||
    editMessageMemory.user_details?.username?.trim() ||
    ''

  return (
    <MessageContextBar
      kind="edit"
      icon={<Icons.edit size={16} />}
      onDismiss={handleClose}
      dismissLabel="Cancel edit">
      <span className="text-warning text-xs font-semibold antialiased">
        Edit message
        {author ? <span className="text-base-content ml-1 font-normal">{author}</span> : null}
      </span>
      <span className="text-base-content/80 text-sm break-words wrap-anywhere whitespace-pre-wrap">
        {editMessageMemory.content}
      </span>
    </MessageContextBar>
  )
}

export default EditContext
