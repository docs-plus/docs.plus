import React from 'react'
import { CgMailReply } from 'react-icons/cg'
import { TbPinnedFilled } from 'react-icons/tb'
import ReactionsCard from './ReactionsCard'

interface MessageFooterProps {
  data: {
    metadata?: {
      replied?: string[]
      pinned?: boolean
    }
    edited_at?: string
    created_at: string
    reactions?: any
  }
}

// Helper function to format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  })
}

const ReplyIndicator = ({ count }: { count: number | undefined }) =>
  count ? (
    <div className="flex items-center">
      <CgMailReply size={16} />
      <span className="text-xs">{count}</span>
    </div>
  ) : null

const PinIndicator = ({ isPinned }: { isPinned?: boolean }) =>
  isPinned ? <TbPinnedFilled className=" h-4 w-4 rotate-45 text-gray-300" /> : null

const EditedIndicator = ({ isEdited }: { isEdited?: boolean }) =>
  isEdited ? <span className="text-xs text-gray-300 text-opacity-50">edited</span> : null

const Timestamp = ({ time }: { time: string }) => (
  <time className="whitespace-nowrap text-xs opacity-50">{time}</time>
)

const MessageFooter: React.FC<MessageFooterProps> = ({ data }) => {
  const countRepliedMessages = data.metadata?.replied?.length
  const createdAt = formatDate(data.created_at)

  return (
    <div className="chat-footer mt-1 flex items-center justify-end">
      {data.reactions && <ReactionsCard reactions={data.reactions} message={data} />}

      <div className="flex shrink items-center gap-2">
        <ReplyIndicator count={countRepliedMessages} />
        <PinIndicator isPinned={data.metadata?.pinned} />
        <EditedIndicator isEdited={!!data.edited_at} />
        <Timestamp time={createdAt} />
      </div>
    </div>
  )
}

export default MessageFooter
