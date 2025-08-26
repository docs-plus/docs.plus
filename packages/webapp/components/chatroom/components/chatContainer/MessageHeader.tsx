import React from 'react'
import { MsgForwardIndicator } from './MsgForwardIndicator'
import { TMessageWithUser } from '@api'

// Helper function to get the origin of the forwarded message
const getForwardMessageOrigin = (data: TMessageWithUser) => {
  return data?.origin_message_id && data?.metadata?.forwarding_chain?.at(-1)?.username
}

type Props = {
  data: TMessageWithUser
  ownerMsg?: boolean
}
const MessageHeader = ({ data, ownerMsg }: Props) => {
  const forwardMessageOrigin = getForwardMessageOrigin(data)
  const userDisplayName = data?.user_details?.display_name

  return (
    <div className="chat-header">
      {data.isGroupStart && !ownerMsg && (
        <div className="chat-header text-secondary">{userDisplayName}</div>
      )}

      <MsgForwardIndicator forwardMessageOrigin={forwardMessageOrigin} />
    </div>
  )
}

export default MessageHeader
