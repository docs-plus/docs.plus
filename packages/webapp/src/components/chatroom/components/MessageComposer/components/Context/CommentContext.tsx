import CloseButton from '@components/ui/CloseButton'
import { Icons } from '@icons'

import { useChatroomContext } from '../../../../ChatroomContext'
import { useMessageComposer } from '../../hooks/useMessageComposer'

const CommentContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
  const { setCommentMsgMemory, commentMessageMemory } = useMessageComposer()

  const handleClose = () => {
    setCommentMsgMemory(channelId, null)
    onDismiss?.()
  }

  if (!commentMessageMemory) return null
  if (commentMessageMemory?.channel_id !== channelId) return null
  return (
    <div className="text-base-content border-base-300 -mb-1 flex w-full items-center justify-between rounded-t-lg border border-b-0 px-4 py-2 shadow-sm">
      <Icons.comment size={24} />
      <div className="text-base-content flex w-full flex-col justify-start pl-3 text-base">
        <span className="text-sm">{commentMessageMemory?.content}</span>
      </div>
      <CloseButton onClick={handleClose} size="xs" aria-label="Dismiss comment" />
    </div>
  )
}

export default CommentContext
