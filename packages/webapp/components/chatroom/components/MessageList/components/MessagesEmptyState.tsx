import { useMessageListContext } from '../MessageListContext'

type Props = {
  children: React.ReactNode
}
export const MessagesEmptyState = ({ children }: Props) => {
  const { messages } = useMessageListContext()

  if (messages && messages.size > 0) return children

  return (
    <div className="flex h-full items-center justify-center">
      <div className="badge badge-neutral">No messages yet!</div>
    </div>
  )
}
