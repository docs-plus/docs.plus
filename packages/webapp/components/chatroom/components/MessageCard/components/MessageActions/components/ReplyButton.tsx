import { ReplyMD } from '@components/icons/Icons'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {}
export const ReplyButton = ({}: Props) => {
  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { message } = useMessageCardContext()

  return (
    <div>
      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Reply to Message"
        onClick={() => replyInMessageHandler(message)}>
        <ReplyMD size={20} className="text-gray-600" />
      </button>
    </div>
  )
}
