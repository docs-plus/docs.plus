import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import Button from '@components/ui/Button'
import { Icons } from '@icons'

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
      className={`join-item ${className || ''}`}
      onClick={() => replyInThreadHandler(message)}
      startIcon={<Icons.thread size={18} className="text-primary" />}
      tooltip="Reply in thread"
      tooltipPlacement="left"
    />
  )
}
