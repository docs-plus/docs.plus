import { useChatroomContext } from '@components/chatroom/ChatroomContext'

interface Props {
  children: React.ReactNode
}

// Overlayer for loading state of the message feed
export const MessageFeedLoading = ({ children }: Props) => {
  const { initLoadMessages } = useChatroomContext()

  // Exit fades 200ms into the loaded feed; visibility swaps after the fade so the
  // overlay ends fully hidden. Enter stays instant (visible state has no transition).
  return (
    <>
      <div
        className={`bg-base-100 absolute z-50 flex size-full items-center justify-center ${
          initLoadMessages
            ? 'visible opacity-100'
            : 'pointer-events-none invisible opacity-0 motion-safe:[transition:opacity_200ms_ease-out,visibility_0s_200ms]'
        }`}>
        <div className="flex w-full items-center justify-center">
          <span className="loading loading-spinner text-primary"></span>
        </div>
      </div>
      {children}
    </>
  )
}
