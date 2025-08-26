import PinnedMessagesSlider from '../MessageFeed/components/PinnedMessages/PinnedMessagesSlider'
import { useChatStore } from 'stores'
import { useChatroomContext } from '../../ChatroomContext'

export const PinnedMessagesDisplay = ({ loading }: any) => {
  const { channelId } = useChatroomContext()

  const channelPinnedMessages = useChatStore((state: any) => state.pinnedMessages)
  const pinnedMessages = channelPinnedMessages.get(channelId)

  if (!pinnedMessages || pinnedMessages?.size === 0) return null

  return (
    <div
      className="bg-base-100 relative z-10 w-full"
      style={{ display: loading ? 'none' : 'block' }}>
      <PinnedMessagesSlider pinnedMessagesMap={pinnedMessages} />
    </div>
  )
}
