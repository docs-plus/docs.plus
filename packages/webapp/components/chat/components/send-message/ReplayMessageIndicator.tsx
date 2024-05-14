import { FaReply } from 'react-icons/fa'
import { twx, cn } from '@utils/index'
import { IoCloseOutline } from 'react-icons/io5'
import { useStore, useChatStore } from '@stores'
import { useChannel } from '../../context/ChannelProvider'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((props) =>
  cn(
    'btn btn-circle w-8 h-8 btn-xs p-1 mr-2',
    props.$active && 'btn-active',
    props.$size && `w-${props.$size} h-${props.$size}`
  )
)

export const ReplayMessageIndicator = () => {
  const { channelId } = useChannel()

  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) || {}
  )
  const { replayMessageMemory } = channelSettings

  const handleCloseReplayMessage = () => {
    setReplayMessageMemory(channelId, null)
  }

  const replyToUser =
    replayMessageMemory?.user_details?.fullname || replayMessageMemory?.user_details?.username || ''

  if (!replayMessageMemory) return null

  if (replayMessageMemory.channel_id !== channelId) return null

  return (
    <div className="flex w-full  items-center justify-between px-4 py-2 text-base-content">
      <FaReply size={24} />
      <div className="flex w-full flex-col justify-start pl-3 text-base text-base-content">
        <span className="font-semibold text-primary antialiased">
          Reply to
          <span className=" ml-1 font-normal">{replyToUser}</span>
        </span>
        <span className="text-sm">{replayMessageMemory?.content}</span>
      </div>
      <IconButton onClick={handleCloseReplayMessage}>
        <IoCloseOutline size={22} />
      </IconButton>
    </div>
  )
}
