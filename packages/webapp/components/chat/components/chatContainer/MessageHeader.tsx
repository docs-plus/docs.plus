import React from 'react'
import { MsgForwardIndicator } from './MsgForwardIndicator'
import { MsgReplyTo } from './MsgReplyTo'
import { TMessageWithUser } from '@api'

// Assuming TypeScript usage for better type safety

// Helper function to get the origin of the forwarded message
const getForwardMessageOrigin = (data: TMessageWithUser) => {
  return data?.origin_message_id && data?.metadata?.forwarding_chain?.at(-1)?.username
}

// Helper function to get the user display name
const getUserDisplayName = (data: TMessageWithUser) => {
  return data?.user_details?.display_name || data?.user_details?.username
}

const MessageHeader: React.FC<{ data: TMessageWithUser; ownerMsg?: boolean }> = ({
  data,
  ownerMsg
}) => {
  const forwardMessageOrigin = getForwardMessageOrigin(data)
  const userDisplayName = getUserDisplayName(data)

  return (
    <div className="chat-header">
      {data.isGroupStart && !ownerMsg && (
        <div className="chat-header text-secondary">{userDisplayName}</div>
      )}

      <MsgForwardIndicator forwardMessageOrigin={forwardMessageOrigin} />

      {data.reply_to_message_id && <MsgReplyTo data={data} />}
    </div>
  )
}

export default MessageHeader
