import { useMessageCardContext } from '../../../MessageCardContext'
import { useMemo } from 'react'

export const ReplyReference = () => {
  const { message } = useMessageCardContext()

  const userReplyTo = useMemo(() => {
    return (
      message?.replied_message_details?.user?.fullname ||
      message?.replied_message_details?.user?.username
    )
  }, [message])

  if (!message.reply_to_message_id) return null

  return (
    <div className="bg-base-200 text-base-content mb-1 w-[98%] rounded border-l-4 border-cyan-400 p-1">
      <div className="chat-header text-xs font-bold">
        <>
          <div className="text-xs font-bold">{userReplyTo}</div>
          <time className="text-xs whitespace-nowrap opacity-50">
            {new Date(message?.replied_message_details?.message?.created_at).toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }
            )}
          </time>
        </>
      </div>
      <p className="m-0 text-sm" dir="auto">
        {message?.replied_message_preview}
      </p>
    </div>
  )
}
