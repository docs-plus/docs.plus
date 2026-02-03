import { twMerge } from 'tailwind-merge'

import {
  Breadcrumb,
  CloseButton,
  NotificationToggle,
  ParticipantsList,
  ShareButton
} from './components'

type Props = {
  children: React.ReactNode
  className?: string
}

const ChatroomToolbar = ({ children, className }: Props) => {
  return <div className={twMerge('chatroom-toolbar', className)}>{children}</div>
}

export default ChatroomToolbar

ChatroomToolbar.Breadcrumb = Breadcrumb
ChatroomToolbar.ParticipantsList = ParticipantsList
ChatroomToolbar.ShareButton = ShareButton
ChatroomToolbar.NotificationToggle = NotificationToggle
ChatroomToolbar.CloseButton = CloseButton
