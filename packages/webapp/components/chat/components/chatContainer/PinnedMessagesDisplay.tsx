import PinnedMessagesSlider from '../PinnedMessagesSlider'
import { useChatStore } from '@stores'

export const PinnedMessagesDisplay = ({ loading }: any) => {
  const { headingId: channelId } = useChatStore((state) => state.chatRoom)
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
