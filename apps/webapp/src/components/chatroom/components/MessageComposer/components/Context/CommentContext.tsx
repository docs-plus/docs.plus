import { CommentAnchorPreview } from '@components/chatroom/components/CommentAnchorPreview'
import { Icons } from '@icons'
import { getCommentAnchorLabel } from '@services/commentAnchor'
import { commentReferenceTheme } from '@utils/commentReferenceTheme'
import { twMerge } from 'tailwind-merge'

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
  const theme = commentReferenceTheme(anchor)
  const typeLabel = getCommentAnchorLabel(anchor)

  return (
    <MessageContextBar
      kind="comment"
      commentTheme={theme}
      icon={<Icons.comment size={16} />}
      onDismiss={handleClose}
      dismissLabel="Dismiss comment">
      <span className={twMerge('text-xs font-semibold antialiased', theme.emphasis)}>
        Document comment
        <span className="ml-1 font-normal">· {typeLabel}</span>
      </span>
      <CommentAnchorPreview anchor={anchor} theme={theme} variant="composer" />
    </MessageContextBar>
  )
}

export default CommentContext
