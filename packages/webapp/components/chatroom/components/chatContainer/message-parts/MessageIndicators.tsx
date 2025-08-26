import React from 'react'
import { TMessageWithUser as TMsg } from '@api'
import { CgMailReply } from 'react-icons/cg'

// Helper components
const ReplyIndicator = ({ count }: { count: number | undefined }) =>
  count ? (
    <div className="flex items-center">
      <CgMailReply size={16} />
      <span className="text-xs">{count}</span>
    </div>
  ) : null

const EditedIndicator = ({ isEdited }: { isEdited?: boolean }) =>
  isEdited ? <span className="text-base-content text-opacity-50 text-xs">edited</span> : null

export const MessageIndicators = ({ message }: { message: TMsg }) => {
  const countRepliedMessages = message.metadata?.replied?.length
  return (
    <div className={`chat-footer text-base-content mt-1 flex items-center justify-end gap-2 px-2`}>
      <div className="flex items-center gap-2">
        <ReplyIndicator count={countRepliedMessages} />
        <EditedIndicator isEdited={!!message.edited_at} />
      </div>
    </div>
  )
}
