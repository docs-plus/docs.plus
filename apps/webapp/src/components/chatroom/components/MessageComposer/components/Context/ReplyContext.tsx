import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { Icons } from '@icons'
import { messagePreviewText } from '@utils/messagePreview'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useScrollFeedOnContextOpen } from '../../hooks/useScrollFeedOnContextOpen'
import { ContextBarMediaThumb } from './ContextBarMediaThumb'
import { MessageContextBar } from './MessageContextBar'

const ReplyContext = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { channelId } = useChatroomContext()
  const { replyMessageMemory, setReplyMsgMemory } = useMessageComposer()

  useScrollFeedOnContextOpen(replyMessageMemory)

  const handleClose = () => {
    setReplyMsgMemory(channelId, null)
    onDismiss?.()
  }

  if (!replyMessageMemory || replyMessageMemory.channel_id !== channelId) return null

  const replyToUser =
    replyMessageMemory.user_details?.fullname?.trim() ||
    replyMessageMemory.user_details?.username?.trim() ||
    'someone'

  const medias = parseMessageMedias(replyMessageMemory.medias)
  const preview = messagePreviewText(replyMessageMemory.content, medias, replyMessageMemory.type)

  return (
    <MessageContextBar
      kind="reply"
      icon={<Icons.reply size={16} />}
      onDismiss={handleClose}
      dismissLabel="Dismiss reply">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-info text-xs font-semibold antialiased">
            Reply
            <span className="text-base-content ml-1 font-normal">to {replyToUser}</span>
          </span>
          {preview ? (
            <span className="text-base-content/80 line-clamp-2 break-words wrap-anywhere whitespace-pre-wrap">
              {preview}
            </span>
          ) : null}
        </div>
        <ContextBarMediaThumb medias={medias} />
      </div>
    </MessageContextBar>
  )
}

export default ReplyContext
