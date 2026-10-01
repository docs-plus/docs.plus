import { CommentAnchorPreview } from '@components/chatroom/components/CommentAnchorPreview'
import { Icons } from '@icons'
import { getCommentAnchorLabel } from '@services/commentAnchor'
import { commentReferenceTheme } from '@utils/commentReferenceTheme'

import { useChatroomContext } from '../../../../ChatroomContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { MessageContextBar } from './MessageContextBar'

const CommentContext = () => {
  const { channelId } = useChatroomContext()
  const { setCommentMsgMemory, commentMessageMemory } = useMessageComposer()

  if (!commentMessageMemory || commentMessageMemory.channel_id !== channelId) return null

  const { anchor } = commentMessageMemory
  const theme = commentReferenceTheme(anchor)
  const typeLabel = getCommentAnchorLabel(anchor)

  return (
    <MessageContextBar
      kind="comment"
      commentTheme={theme}
      icon={<Icons.comment size={16} />}
      onDismiss={() => setCommentMsgMemory(channelId, null)}
      dismissLabel="Dismiss comment">
      <span className="text-base-content text-xs font-semibold antialiased">
        Document comment
        <span className="ml-1 font-normal">· {typeLabel}</span>
      </span>
      <CommentAnchorPreview anchor={anchor} variant="composer" />
    </MessageContextBar>
  )
}

export default CommentContext
