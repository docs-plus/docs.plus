import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import Button from '@components/ui/Button'
import { MdOutlineComment } from 'react-icons/md'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

export const ReplyInThreadButton = ({ className }: Props) => {
  const { replyInThreadHandler } = useReplyInThreadHandler()
  const { message } = useMessageCardContext()

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      className={`join-item tooltip tooltip-left ${className || ''}`}
      data-tip="Reply in thread"
      onClick={() => replyInThreadHandler(message)}
      startIcon={<MdOutlineComment size={20} className="text-primary" />}
    />
  )
}
