import { useChatStore } from '@stores'
import { IoCloseSharp } from 'react-icons/io5'
import PubSub from 'pubsub-js'
import { CHAT_CLOSE } from '@services/eventsHub'

type Props = {
  className?: string
  dataTip?: string
}

export const CloseButton = ({ className, dataTip }: Props) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  const handelCloseChatRoom = () => {
    PubSub.publish(CHAT_CLOSE, { headingId: chatRoom.headingId })
  }

  return (
    <button
      className={`btn btn-ghost btn-sm btn-square ${className}`}
      onClick={handelCloseChatRoom}
      data-tip={dataTip}>
      <IoCloseSharp size={20} />
    </button>
  )
}
