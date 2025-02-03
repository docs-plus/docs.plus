import React from 'react'
import { TbPinned } from 'react-icons/tb'
import ReactionsCard from './ReactionsCard'
import { IoCheckmarkSharp } from 'react-icons/io5'
import { IoCheckmarkDoneSharp } from 'react-icons/io5'
import { TMessageWithUser } from '@api'

// Helper function to format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString(navigator.language, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  })
}

const PinIndicator = ({ isPinned }: { isPinned?: boolean }) =>
  isPinned ? <TbPinned className="size-4 rotate-45 text-gray-300" /> : null

const EditedIndicator = ({ isEdited }: { isEdited?: boolean }) =>
  isEdited ? <span className="text-xs text-gray-300 text-opacity-50">edited</span> : null

const Timestamp = ({ time, readed_at }: { time: string; readed_at: string | null }) => {
  return (
    <div className="flex space-x-1 rounded bg-base-100/10 px-1">
      <time className="whitespace-nowrap text-xs opacity-50">{time}</time>
      <div>
        {!readed_at ? <IoCheckmarkSharp className="size-4 text-gray-300" /> : null}
        {readed_at ? <IoCheckmarkDoneSharp className="size-4 text-gray-300" /> : null}
      </div>
    </div>
  )
}

const ThreadMessageFooter: React.FC<{ data: TMessageWithUser }> = ({ data }) => {
  const createdAt = formatDate(data.created_at)

  return (
    <div className="chat-footer mt-1 flex items-center justify-end gap-2">
      {data.reactions && <ReactionsCard reactions={data.reactions} message={data} />}

      <div className="flex shrink items-center gap-2">
        <PinIndicator isPinned={data.metadata?.pinned} />
        <EditedIndicator isEdited={!!data.edited_at} />
        <Timestamp time={createdAt} readed_at={data.readed_at} />
      </div>
    </div>
  )
}

export default ThreadMessageFooter
