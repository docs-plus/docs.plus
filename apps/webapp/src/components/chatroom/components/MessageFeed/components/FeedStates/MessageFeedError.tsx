import { useChatroomContext } from '@components/chatroom/ChatroomContext'

interface Props {
  children: React.ReactNode
}

export const MessageFeedError = ({ children }: Props) => {
  const { error } = useChatroomContext()

  if (!error) return children

  return (
    <div className="bg-base-100 flex min-h-0 flex-1 items-center justify-center px-4 py-8">
      <div className="badge badge-error">Error loading messages...</div>
    </div>
  )
}
