import { useChatroomContext } from '@components/chatroom/ChatroomContext'

interface Props {
  children: React.ReactNode
}

// Overlayer for loading state of the message feed
export const MessageFeedLoading = ({ children }: Props) => {
  const { initLoadMessages } = useChatroomContext()

  return (
    <>
      <div
        className="bg-base-100 absolute z-50 flex size-full items-center justify-center"
        style={{ display: initLoadMessages ? 'flex' : 'none' }}>
        <div className="flex w-full items-center justify-center">
          <span className="loading loading-spinner text-primary"></span>
        </div>
      </div>
      {children}
    </>
  )
}
