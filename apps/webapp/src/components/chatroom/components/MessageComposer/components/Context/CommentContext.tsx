import { CommentAnchorPreview } from '@components/chatroom/components/CommentAnchorPreview'
import { Icons } from '@icons'
import { getCommentAnchorLabel } from '@services/commentAnchor'

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

  if (!commentMessageMemory || commentMessageMemory.channel_id !== channelId) return null

  const { anchor } = commentMessageMemory

  return (
    <MessageContextBar
      kind="comment"
      icon={<Icons.comment size={16} />}
      onDismiss={handleClose}
      dismissLabel="Dismiss comment">
      <span className="text-secondary text-xs font-semibold antialiased">
        Document comment
        <span className="text-base-content ml-1 font-normal">
          · {getCommentAnchorLabel(anchor)}
        </span>
      </span>
      <CommentAnchorPreview anchor={anchor} variant="composer" />
    </MessageContextBar>
  )
}

export default CommentContext
