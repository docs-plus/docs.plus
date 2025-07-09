import { twx, cn } from '@utils/index'
import { IoCloseOutline } from 'react-icons/io5'
import { useChatStore } from '@stores'
import { useChannel } from '../../context/ChannelProvider'
import { MdInsertComment } from 'react-icons/md'
import { useMemo } from 'react'
import { TChannelSettings } from '@types'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((props) =>
  cn(
    'btn btn-square w-8 h-8 btn-xs p-1',
    props.$active && 'btn-active',
    props.$size && `w-${props.$size} h-${props.$size}`
  )
)

export const CommentMessageIndicator = () => {
  const { channelId } = useChannel()

  const setCommentMessageMemory = useChatStore((state) => state.setCommentMessageMemory)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  const { commentMessageMemory } = channelSettings ?? {}

  const handleCloseReplyMessage = () => {
    setCommentMessageMemory(channelId, null)
  }

  if (!commentMessageMemory) return null
  if (commentMessageMemory?.channel_id !== channelId) return null

  return (
    <div className="text-base-content relative -bottom-1 flex w-full items-center justify-between rounded-t-lg border border-b-0 border-gray-200 px-4 py-2 shadow-[0_-2px_6px_-1px_rgba(0,0,0,0.1)]">
      <MdInsertComment size={24} />
      <div className="text-base-content flex w-full flex-col justify-start pl-3 text-base">
        <span className="text-sm">{commentMessageMemory?.content}</span>
      </div>
      <IconButton onClick={handleCloseReplyMessage}>
        <IoCloseOutline size={22} />
      </IconButton>
    </div>
  )
}
