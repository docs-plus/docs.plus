import Button from '@components/ui/Button'
import { CHAT_CLOSE } from '@services/eventsHub'
import { useChatStore } from '@stores'
import PubSub from 'pubsub-js'
import { LuX } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const CloseButton = ({ className }: Props) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  const handelCloseChatRoom = () => {
    PubSub.publish(CHAT_CLOSE, { headingId: chatRoom.headingId })
  }

  return (
    <Button
      variant="ghost"
      size="xs"
      shape="square"
      onClick={handelCloseChatRoom}
      className={twMerge(
        'text-base-content/60 hover:text-base-content hover:bg-base-300 focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
      aria-label="Close chatroom">
      <LuX size={16} />
    </Button>
  )
}
