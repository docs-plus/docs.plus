import { FaReply } from 'react-icons/fa'
import { twx, cn } from '@utils/index'
import { IoCloseOutline, IoCloseSharp } from 'react-icons/io5'
import { useChatStore } from '@stores'
import { useChannel } from '../../context/ChannelProvider'
import { useMemo } from 'react'
import { TChannelSettings } from '@types'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((props) =>
  cn(
    'btn btn-square w-8 h-8 btn-xs p-1 ',
    props.$active && 'btn-active',
    props.$size && `w-${props.$size} h-${props.$size}`
  )
)

export const ReplyMessageIndicator = () => {
  const { channelId } = useChannel()

  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  const { replyMessageMemory } = channelSettings ?? {}

  const handleCloseReplyMessage = () => {
    setReplyMessageMemory(channelId, null)
  }

  const replyToUser =
    replyMessageMemory?.user_details?.fullname || replyMessageMemory?.user_details?.username || ''

  if (!replyMessageMemory) return null

  if (replyMessageMemory.channel_id !== channelId) return null

  return (
    <div className="text-base-content relative -bottom-1 flex w-full items-center justify-between rounded-t-lg border border-b-0 border-gray-200 px-4 py-2 shadow-[0_-2px_6px_-1px_rgba(0,0,0,0.1)]">
      <FaReply size={24} />
      <div className="text-base-content flex w-full flex-col justify-start pl-3 text-base">
        <span className="text-primary font-semibold antialiased">
          Reply to
          <span className="ml-1 font-normal">{replyToUser}</span>
        </span>
        <span className="text-sm">{replyMessageMemory?.content}</span>
      </div>
      <IconButton onClick={handleCloseReplyMessage}>
        <IoCloseSharp size={22} />
      </IconButton>
    </div>
  )
}
