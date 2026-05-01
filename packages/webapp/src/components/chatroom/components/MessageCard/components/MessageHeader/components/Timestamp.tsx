import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = { className?: string }

const STATUS_SLOT = 'inline-flex min-w-9 items-center text-xs'

export const Timestamp = ({ className }: Props) => {
  const { variant } = useChatroomContext()
  const { message, isGroupStart } = useMessageCardContext()

  if (message.isOwner && message.status === 'pending') {
    return (
      <span
        className={twMerge('text-base-content/40', STATUS_SLOT, className)}
        aria-label="Sending"
        title="Sending…">
        <Icons.clock size={14} aria-hidden="true" />
      </span>
    )
  }

  if (message.isOwner && message.status === 'failed') {
    return (
      <span
        className={twMerge('text-error', STATUS_SLOT, className)}
        aria-label="Failed to send"
        title={message.statusError ?? 'Failed to send'}>
        <Icons.alert size={14} aria-hidden="true" />
      </span>
    )
  }

  return (
    <time
      className={twMerge(
        STATUS_SLOT,
        'invisible opacity-50',
        isGroupStart ? 'visible' : 'group-hover/msgcard:visible',
        variant === 'mobile' && 'visible',
        className
      )}>
      {new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })}
    </time>
  )
}
