import React from 'react'
import { TMessageWithUser as TMsg } from '@api'

export const MessageHeader = ({ message }: { message: TMsg }) => {
  const userDisplayName = message?.user_details?.display_name || message?.user_details?.fullname
  const isGroupStart = message.isGroupStart

  return (
    <div className="chat-header">
      {isGroupStart && (
        <>
          <div className="text-xs font-bold">{userDisplayName}</div>
          <time className="text-xs whitespace-nowrap opacity-50">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </time>
        </>
      )}
    </div>
  )
}
