import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useBusyAction } from '@components/chatroom/hooks/useBusyAction'

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
  // An unloaded target fetches its window first. An in-window jump settles before paint.
  const [busy, jump] = useBusyAction(scrollToMessage)
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
      onJump={() => void jump(replyToId)}
      busy={busy}
      header={
        <>
          {userReplyTo ? (
            <>
              <span aria-hidden="true" className="text-base-content/50 font-normal">
                ·
              </span>
              <span className="text-base-content font-normal">{userReplyTo}</span>
            </>
          ) : null}
          {repliedTime ? (
            <>
              <span aria-hidden="true" className="text-base-content/50 font-normal">
                ·
              </span>
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
