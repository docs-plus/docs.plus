import { twMerge } from 'tailwind-merge'

import { EditedBadge } from './components/EditedBadge'
import MessageSeen from './components/MesageSeen'
import { ReplyCount } from './components/ReplyCount'

type Props = {
  className?: string
  children?: React.ReactNode
}

const MessageIndicators = ({ className, children }: Props) => {
  return (
    <div
      className={twMerge(
        'chat-footer text-base-content mt-1 flex items-center justify-end gap-2 px-2',
        className
      )}>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export default MessageIndicators

MessageIndicators.ReplyCount = ReplyCount
MessageIndicators.EditedBadge = EditedBadge
MessageIndicators.MessageSeen = MessageSeen
