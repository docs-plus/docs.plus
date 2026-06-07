import { Icons } from '@icons'

import { useChatroomContext } from '../../../../ChatroomContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useScrollFeedOnContextOpen } from '../../hooks/useScrollFeedOnContextOpen'
import { MessageContextBar } from './MessageContextBar'

const ReplyContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
  const { replyMessageMemory, setReplyMsgMemory } = useMessageComposer()

  useScrollFeedOnContextOpen(replyMessageMemory)

  const handleClose = () => {
    setReplyMsgMemory(channelId, null)
    onDismiss?.()
  }

  if (!replyMessageMemory) return null
  if (replyMessageMemory.channel_id !== channelId) return null

  const replyToUser =
    replyMessageMemory.user_details?.fullname?.trim() ||
    replyMessageMemory.user_details?.username?.trim() ||
    'someone'

  return (
    <MessageContextBar
      icon={<Icons.reply size={16} />}
      onDismiss={handleClose}
      dismissLabel="Dismiss reply">
      <span className="text-primary font-semibold antialiased">
        Reply to
        <span className="ml-1 font-normal">{replyToUser}</span>
      </span>
      <span className="text-base-content/80 break-words wrap-anywhere whitespace-pre-wrap">
        {replyMessageMemory.content}
      </span>
    </MessageContextBar>
  )
}

export default ReplyContext
