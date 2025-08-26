import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMemo } from 'react'
import { useChatStore } from '@stores'

interface Props {
  children: React.ReactNode
}

// Overlayer for loading state of the message feed
export const MessageFeedLoading = ({ children }: Props) => {
  const { isDbSubscriptionReady, isChannelDataLoaded } = useChatroomContext()
  const { isReadyToDisplayMessages } = useChatStore((state) => state.chatRoom)

  const loading = useMemo(() => {
    return !isDbSubscriptionReady || !isChannelDataLoaded || !isReadyToDisplayMessages
  }, [isDbSubscriptionReady, isChannelDataLoaded, isReadyToDisplayMessages])

  return (
    <>
      <div
        className="bg-base-100 absolute z-50 flex size-full items-center justify-center"
        style={{ display: loading ? 'flex' : 'none' }}>
        <div className="flex w-full items-center justify-center">
          <span className="loading loading-spinner text-primary"></span>
        </div>
      </div>
      {children}
    </>
  )
}
