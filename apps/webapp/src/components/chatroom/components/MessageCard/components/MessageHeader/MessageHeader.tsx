import { twMerge } from '@utils/twMerge'

import { BookmarkIndicator, Timestamp, UserAvatar, Username } from './components'

type Props = {
  className?: string
  children?: React.ReactNode
}

const MessageHeader = ({ className, children }: Props) => {
  return <div className={twMerge('message-header', className)}>{children}</div>
}

export default MessageHeader

MessageHeader.BookmarkIndicator = BookmarkIndicator
MessageHeader.Username = Username
MessageHeader.Timestamp = Timestamp
MessageHeader.UserAvatar = UserAvatar
