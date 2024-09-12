import { FaReply } from 'react-icons/fa'
import { twx, cn } from '@utils/index'
import { IoCloseOutline } from 'react-icons/io5'
import { useChatStore } from '@stores'
import { useChannel } from '../../context/ChannelProvider'
import { MdInsertComment } from 'react-icons/md'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((props) =>
  cn(
    'btn btn-circle w-8 h-8 btn-xs p-1 mr-2',
    props.$active && 'btn-active',
    props.$size && `w-${props.$size} h-${props.$size}`
  )
)

export const CommentMessageIndicator = () => {
  const { channelId } = useChannel()

  const setCommentMessageMemory = useChatStore((state) => state.setCommentMessageMemory)
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) || {}
  )
  const { commentMessageMemory } = channelSettings

  const handleCloseReplayMessage = () => {
    setCommentMessageMemory(channelId, null)
  }

  if (!commentMessageMemory) return null
  if (commentMessageMemory?.channel_id !== channelId) return null

  return (
    <div className="flex w-full items-center justify-between px-4 py-2 text-base-content">
      <MdInsertComment size={24} />
      <div className="flex w-full flex-col justify-start pl-3 text-base text-base-content">
        <span className="text-sm">{commentMessageMemory?.content}</span>
      </div>
      <IconButton onClick={handleCloseReplayMessage}>
        <IoCloseOutline size={22} />
      </IconButton>
    </div>
  )
}
