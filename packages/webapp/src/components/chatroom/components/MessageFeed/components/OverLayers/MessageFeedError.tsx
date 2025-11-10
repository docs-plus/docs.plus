import { useChatroomContext } from '@components/chatroom/ChatroomContext'

interface Props {
  children: React.ReactNode
}

export const MessageFeedError = ({ children }: Props) => {
  const { error } = useChatroomContext()

  if (!error) return children

  return (
    <div className="bg-base-300 flex h-dvh w-full max-w-full items-center justify-center">
      <div className="badge badge-error">Error loading messages...</div>
    </div>
  )
}
