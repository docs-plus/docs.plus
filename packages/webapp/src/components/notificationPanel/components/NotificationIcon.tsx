import {
  LuAtSign,
  LuUsers,
  LuSmile,
  LuMessageSquare,
  LuReply,
  LuMessagesSquare,
  LuMail,
  LuMegaphone,
  LuTriangleAlert
} from 'react-icons/lu'

const NotificationIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
  const iconProps = { size, className: 'text-base-content/60' }

  switch (type) {
    case 'mention':
      return (
        <span className="tooltip tooltip-right" data-tip="Mention">
          <LuAtSign {...iconProps} />
        </span>
      )
    case 'message':
      return (
        <span className="tooltip tooltip-right" data-tip="Message">
          <LuMessageSquare {...iconProps} />
        </span>
      )
    case 'reply':
      return (
        <span className="tooltip tooltip-right" data-tip="Reply">
          <LuReply {...iconProps} />
        </span>
      )
    case 'reaction':
      return (
        <span className="tooltip tooltip-right" data-tip="Reaction">
          <LuSmile {...iconProps} />
        </span>
      )
    case 'thread_message':
      return (
        <span className="tooltip tooltip-right" data-tip="Thread Message">
          <LuMessagesSquare {...iconProps} />
        </span>
      )
    case 'channel_event':
      return (
        <span className="tooltip tooltip-right" data-tip="Channel Event">
          <LuMegaphone {...iconProps} />
        </span>
      )
    case 'direct_message':
      return (
        <span className="tooltip tooltip-right" data-tip="Direct Message">
          <LuMail {...iconProps} />
        </span>
      )
    case 'invitation':
      return (
        <span className="tooltip tooltip-right" data-tip="Invitation">
          <LuUsers {...iconProps} />
        </span>
      )
    case 'system_alert':
      return (
        <span className="tooltip tooltip-right" data-tip="System Alert">
          <LuTriangleAlert {...iconProps} />
        </span>
      )
    default:
      return null
  }
}

export default NotificationIcon
