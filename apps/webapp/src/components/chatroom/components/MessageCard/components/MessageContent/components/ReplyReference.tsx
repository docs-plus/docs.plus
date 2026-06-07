import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useCallback } from 'react'

import { useMessageCardContext } from '../../../MessageCardContext'
import { ReferenceJumpButton } from './ReferenceJumpButton'

export const ReplyReference = () => {
  const { message } = useMessageCardContext()
  const { scrollToMessage } = useChatroomContext()
  const replyToId = message.reply_to_message_id

  const onJump = useCallback(() => {
    if (!replyToId) return
    void scrollToMessage(replyToId)
  }, [replyToId, scrollToMessage])

  if (!replyToId) return null

  const repliedUser = message.replied_message_details?.user
  const userReplyTo = repliedUser?.fullname || repliedUser?.username
  const repliedAt = message.replied_message_details?.message?.created_at
  const repliedTime =
    repliedAt && !Number.isNaN(Date.parse(repliedAt))
      ? new Date(repliedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      : null

  return (
    <ReferenceJumpButton
      dataKey={`reply-ref-${replyToId}`}
      ariaLabel={userReplyTo ? `Jump to message from ${userReplyTo}` : 'Jump to replied message'}
      widthClass="w-[98%]"
      onJump={onJump}>
      <div className="chat-header text-xs font-bold">
        <div className="text-xs font-bold">{userReplyTo}</div>
        {repliedTime ? (
          <time className="text-xs whitespace-nowrap opacity-50">{repliedTime}</time>
        ) : null}
      </div>
      <p className="m-0 text-sm" dir="auto">
        {message.replied_message_preview}
      </p>
    </ReferenceJumpButton>
  )
}
