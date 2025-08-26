import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import { MdOutlineComment } from 'react-icons/md'
import { useMessageCardContext } from '../../../MessageCardContext'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const ReplyInThreadButton = ({ className }: Props) => {
  const { replyInThreadHandler } = useReplyInThreadHandler()
  const { message } = useMessageCardContext()

  return (
    <button
      className={twMerge(
        'btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left',
        className
      )}
      data-tip="Reply in thread"
      onClick={() => replyInThreadHandler(message)}>
      <MdOutlineComment size={20} className="text-docsy" />
    </button>
  )
}
