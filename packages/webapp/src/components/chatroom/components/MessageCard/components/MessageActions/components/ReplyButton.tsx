import { ReplyMD } from '@components/icons/Icons'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useMessageCardContext } from '../../../MessageCardContext'
import { useAuthStore } from '@stores'
import Button from '@components/ui/Button'

export const ReplyButton = () => {
  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { message } = useMessageCardContext()
  const profile = useAuthStore((state) => state.profile)

  return (
    <div>
      <Button
        disabled={!profile}
        variant="ghost"
        size="sm"
        shape="square"
        className="join-item tooltip tooltip-left"
        data-tip="Reply to Message"
        onClick={() => replyInMessageHandler(message)}
        startIcon={<ReplyMD size={20} className="text-base-content/70" />}
      />
    </div>
  )
}
