import React from 'react'
import { MsgForwardIndicator } from './MsgForwardIndicator'
import { MsgReplyTo } from './MsgReplyTo'

// Assuming TypeScript usage for better type safety
interface MessageHeaderProps {
  data: {
    isGroupStart?: boolean
    isGroupEnd?: boolean
    isNewGroupById?: boolean
    origin_message_id?: string
    metadata?: {
      forwarding_chain?: Array<{ username: string }>
    }
    user_details?: {
      display_name?: string
      username?: string
    }
    reply_to_message_id?: string
  }
}

// Helper function to get the origin of the forwarded message
const getForwardMessageOrigin = (data: MessageHeaderProps['data']) => {
  return data?.origin_message_id && data?.metadata?.forwarding_chain?.at(-1)?.username
}

// Helper function to get the user display name
const getUserDisplayName = (data: MessageHeaderProps['data']) => {
  return data?.user_details?.display_name || data?.user_details?.username
}

const MessageHeader: React.FC<MessageHeaderProps> = ({ data }) => {
  const forwardMessageOrigin = getForwardMessageOrigin(data)
  const userDisplayName = getUserDisplayName(data)

  return (
    <>
      {data.isGroupStart && <div className="chat-header text-secondary">{userDisplayName}</div>}

      <MsgForwardIndicator forwardMessageOrigin={forwardMessageOrigin} />

      {data.reply_to_message_id && <MsgReplyTo data={data} />}
    </>
  )
}

export default MessageHeader
