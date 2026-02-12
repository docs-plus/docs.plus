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

/**
 * Chatroom toolbar — sticky header for the chat panel.
 *
 * Design System:
 * - Surface: bg-base-100 (primary canvas)
 * - Border: border-b border-base-300
 * - Layout: flex row, items centered, gap-2
 * - Padding: px-3 py-1.5 (compact but touchable)
 */
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
