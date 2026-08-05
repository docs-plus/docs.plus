import SharedCloseButton from '@components/ui/CloseButton'
import { CHAT_CLOSE } from '@services/eventsHub'
import { useChatStore } from '@stores'
import { stripChatDeepLinkFromBrowserUrl } from '@utils/stripChatDeepLinkFromUrl'
import PubSub from 'pubsub-js'

type Props = {
  className?: string
}

export const CloseButton = ({ className }: Props) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  const handleCloseChatRoom = () => {
    const headingId = chatRoom.headingId
    PubSub.publish(CHAT_CLOSE, { headingId })
    stripChatDeepLinkFromBrowserUrl(headingId)
  }

  return (
    <SharedCloseButton
      onClick={handleCloseChatRoom}
      className={className}
      aria-label="Close chatroom"
    />
  )
}
