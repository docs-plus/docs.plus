import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { Icons } from '@icons'
import { messagePreviewText } from '@utils/messagePreview'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useScrollFeedOnContextOpen } from '../../hooks/useScrollFeedOnContextOpen'
import { ContextBarMediaThumb } from './ContextBarMediaThumb'
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

  const medias = parseMessageMedias(editMessageMemory.medias)
  const preview = messagePreviewText(editMessageMemory.content, medias, editMessageMemory.type)

  return (
    <MessageContextBar
      kind="edit"
      icon={<Icons.edit size={16} />}
      onDismiss={handleClose}
      dismissLabel="Cancel edit">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-warning text-xs font-semibold antialiased">
            Edit message
            {author ? <span className="text-base-content ml-1 font-normal">{author}</span> : null}
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

export default EditContext
