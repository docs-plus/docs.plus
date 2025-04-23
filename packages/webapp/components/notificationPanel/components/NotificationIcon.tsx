import { IoChatboxOutline, IoMailOutline } from 'react-icons/io5'
import { BsReply, BsMegaphone } from 'react-icons/bs'
import { MdAlternateEmail, MdGroup, MdEmojiEmotions, MdMessage } from 'react-icons/md'
import { AiOutlineAlert } from 'react-icons/ai'

const NotificationIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
  const iconProps = { size, className: 'text-gray-600 rounded-md' }
  switch (type) {
    case 'mention':
      return (
        <span className="tooltip tooltip-right" data-tip="Mention">
          <MdAlternateEmail {...iconProps} />
        </span>
      )
    case 'message':
      return (
        <span className="tooltip tooltip-right" data-tip="Message">
          <MdMessage {...iconProps} />
        </span>
      )
    case 'reply':
      return (
        <span className="tooltip tooltip-right" data-tip="Reply">
          <BsReply {...iconProps} />
        </span>
      )
    case 'reaction':
      return (
        <span className="tooltip tooltip-right" data-tip="Reaction">
          <MdEmojiEmotions {...iconProps} />
        </span>
      )
    case 'thread_message':
      return (
        <span className="tooltip tooltip-right" data-tip="Thread Message">
          <IoChatboxOutline {...iconProps} />
        </span>
      )
    case 'channel_event':
      return (
        <span className="tooltip tooltip-right" data-tip="Channel Event">
          <BsMegaphone {...iconProps} />
        </span>
      )
    case 'direct_message':
      return (
        <span className="tooltip tooltip-right" data-tip="Direct Message">
          <IoMailOutline {...iconProps} />
        </span>
      )
    case 'invitation':
      return (
        <span className="tooltip tooltip-right" data-tip="Invitation">
          <MdGroup {...iconProps} />
        </span>
      )
    case 'system_alert':
      return (
        <span className="tooltip tooltip-right" data-tip="System Alert">
          <AiOutlineAlert {...iconProps} />
        </span>
      )
    default:
      return null
  }
}

export default NotificationIcon
