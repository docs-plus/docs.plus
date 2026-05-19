import { Icons } from '@icons'

import { useChatroomContext } from '../../../../ChatroomContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { MessageContextBar } from './MessageContextBar'

const CommentContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
  const { setCommentMsgMemory, commentMessageMemory } = useMessageComposer()

  const handleClose = () => {
    setCommentMsgMemory(channelId, null)
    onDismiss?.()
  }

  if (!commentMessageMemory) return null
  if (commentMessageMemory.channel_id !== channelId) return null

  return (
    <MessageContextBar
      icon={<Icons.comment size={24} />}
      onDismiss={handleClose}
      dismissLabel="Dismiss comment">
      <span className="text-base-content/80 text-sm break-words wrap-anywhere whitespace-pre-wrap">
        {commentMessageMemory.content}
      </span>
    </MessageContextBar>
  )
}

export default CommentContext
