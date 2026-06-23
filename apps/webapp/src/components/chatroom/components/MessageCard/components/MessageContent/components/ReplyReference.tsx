import { useChatroomContext } from '@components/chatroom/ChatroomContext'

import { useMessageCardContext } from '../../../MessageCardContext'
import { ReferenceJumpButton } from './ReferenceJumpButton'

function formatReplyTime(iso: string | undefined): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export const ReplyReference = () => {
  const { message } = useMessageCardContext()
  const { scrollToMessage } = useChatroomContext()
  const replyToId = message.reply_to_message_id

  if (!replyToId) return null

  const repliedUser = message.replied_message_details?.user
  const userReplyTo = repliedUser?.fullname || repliedUser?.username
  const repliedAt = message.replied_message_details?.message?.created_at
  const repliedTime = formatReplyTime(repliedAt)

  return (
    <ReferenceJumpButton
      kind="reply"
      dataKey={`reply-ref-${replyToId}`}
      ariaLabel={userReplyTo ? `Jump to message from ${userReplyTo}` : 'Jump to replied message'}
      onJump={() => void scrollToMessage(replyToId)}
      header={
        <>
          {userReplyTo ? (
            <>
              <span className="text-base-content/40 font-normal">·</span>
              <span className="text-base-content font-normal">{userReplyTo}</span>
            </>
          ) : null}
          {repliedTime ? (
            <>
              <span className="text-base-content/40 font-normal">·</span>
              <time className="text-base-content/60 font-normal whitespace-nowrap">
                {repliedTime}
              </time>
            </>
          ) : null}
        </>
      }>
      <p className="m-0 text-sm" dir="auto">
        {message.replied_message_preview}
      </p>
    </ReferenceJumpButton>
  )
}
