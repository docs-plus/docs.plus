import { useMessageCardContext } from '../../../MessageCardContext'

export const ReplyReference = () => {
  const { message } = useMessageCardContext()

  if (!message.reply_to_message_id) return null

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
    <div className="bg-base-200 text-base-content border-info mb-1 w-[98%] rounded border-l-4 p-1">
      <div className="chat-header text-xs font-bold">
        <div className="text-xs font-bold">{userReplyTo}</div>
        {repliedTime ? (
          <time className="text-xs whitespace-nowrap opacity-50">{repliedTime}</time>
        ) : null}
      </div>
      <p className="m-0 text-sm" dir="auto">
        {message.replied_message_preview}
      </p>
    </div>
  )
}
