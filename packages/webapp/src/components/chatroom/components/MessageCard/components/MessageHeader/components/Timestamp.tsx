import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMessageCardContext } from '../../../MessageCardContext'
import { twMerge } from 'tailwind-merge'
import { MdAccessTime } from 'react-icons/md'

type Props = {
  className?: string
}
export const Timestamp = ({ className }: Props) => {
  const { variant } = useChatroomContext()
  const { message, isGroupStart } = useMessageCardContext()

  if (message.id === 'fake_id')
    return (
      <div
        className={twMerge(
          'invisible text-xs opacity-50',
          isGroupStart ? 'visible' : 'group-hover/msgcard:visible',
          variant == 'mobile' && 'visible',
          className
        )}
        style={{ width: '30px' }}>
        <MdAccessTime className="text-xs" />
      </div>
    )
  return (
    <time
      className={twMerge(
        'invisible text-xs opacity-50',
        isGroupStart ? 'visible' : 'group-hover/msgcard:visible',
        variant == 'mobile' && 'visible',
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
