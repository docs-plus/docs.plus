import PinnedMessagesSlider from './PinnedMessagesSlider'
import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'

type Props = {
  className?: string
}

export const PinnedMessages = ({ className }: Props) => {
  const { channelId } = useChatroomContext()
  const { isChannelDataLoaded } = useChatroomContext()
  const channelPinnedMessages = useChatStore((state: any) => state.pinnedMessages)
  const pinnedMessages = channelPinnedMessages.get(channelId)

  if ((!pinnedMessages || pinnedMessages?.size === 0) && !isChannelDataLoaded) return null

  return (
    <div className={twMerge('bg-base-100 relative z-10 w-full', className)}>
      <PinnedMessagesSlider pinnedMessagesMap={pinnedMessages} />
    </div>
  )
}
