import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'

import { useMessageCardContext } from '../../../MessageCardContext'

export const ReplyButton = () => {
  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { message } = useMessageCardContext()
  const profile = useAuthStore((state) => state.profile)

  return (
    <Button
      disabled={!profile}
      variant="ghost"
      size="sm"
      shape="square"
      className="join-item"
      onClick={() => replyInMessageHandler(message)}
      startIcon={<Icons.reply size={20} className="text-base-content/70" />}
      tooltip="Reply to Message"
      tooltipPlacement="left"
    />
  )
}
