import { twMerge } from 'tailwind-merge'

import {
  Breadcrumb,
  CloseButton,
  MediaFilterToggle,
  NotificationToggle,
  ParticipantsList,
  ShareButton
} from './components'

type Props = {
  children: React.ReactNode
  className?: string
}

const ChatroomToolbar = ({ children, className }: Props) => {
  return (
    <div
      className={twMerge(
        'bg-base-100 border-base-300 relative z-50 flex w-full items-center gap-2 border-b px-3 py-1.5',
        className
      )}>
      {children}
    </div>
  )
}

export default ChatroomToolbar

ChatroomToolbar.Breadcrumb = Breadcrumb
ChatroomToolbar.ParticipantsList = ParticipantsList
ChatroomToolbar.ShareButton = ShareButton
ChatroomToolbar.NotificationToggle = NotificationToggle
ChatroomToolbar.CloseButton = CloseButton
ChatroomToolbar.MediaFilterToggle = MediaFilterToggle
