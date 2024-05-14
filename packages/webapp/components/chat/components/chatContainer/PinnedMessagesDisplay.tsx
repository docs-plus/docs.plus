import PinnedMessagesSlider from '../PinnedMessagesSlider'
import { useChatStore } from 'stores'
import { useChannel } from '../../context/ChannelProvider'

export const PinnedMessagesDisplay = ({ loading }: any) => {
  const { channelId } = useChannel()

  const channelPinnedMessages = useChatStore((state: any) => state.pinnedMessages)
  const pinnedMessages = channelPinnedMessages.get(channelId)

  if (!pinnedMessages || pinnedMessages?.size === 0) return null

  return (
    <div
      className="relative z-10 w-full   bg-base-100 "
      style={{ display: loading ? 'none' : 'block' }}>
      <PinnedMessagesSlider pinnedMessagesMap={pinnedMessages} />
    </div>
  )
}
