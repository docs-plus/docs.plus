import React from 'react'
import { CgMailReply } from 'react-icons/cg'
import { TbPinned } from 'react-icons/tb'

import ReactionsCard from './ReactionsCard'
import { IoCheckmarkDoneSharp, IoTimeOutline, IoCheckmarkSharp } from 'react-icons/io5'
import { BiSolidMessageDetail } from 'react-icons/bi'
import { TMessageWithUser } from '@api'

// Helper function to format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString(navigator.language, {
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
  isPinned ? <TbPinned className="size-4 rotate-45 text-base-content" /> : null

const EditedIndicator = ({ isEdited }: { isEdited?: boolean }) =>
  isEdited ? <span className="text-xs text-base-content text-opacity-50">edited</span> : null

const Timestamp = ({
  time,
  readed_at,
  id = null
}: {
  time: string
  readed_at: string | null
  id: string | null
}) => {
  return (
    <div className="flex space-x-1 rounded bg-base-100/10 px-1">
      <time className="whitespace-nowrap text-xs opacity-50">{time}</time>
      {id === 'fake_id' && <IoTimeOutline className="size-4 text-base-content" />}
      <div className={id !== 'fake_id' ? 'block' : 'hidden'}>
        {!readed_at ? <IoCheckmarkSharp className="size-4 text-base-content" /> : null}
        {readed_at ? <IoCheckmarkDoneSharp className="size-4 text-base-content" /> : null}
      </div>
    </div>
  )
}

const ThreadIndicator = ({ count }: { count: number | null }) => {
  if (!count) return
  return (
    <div className="flex items-center justify-between space-x-1 rounded bg-base-100/10 px-1">
      <BiSolidMessageDetail className="size-4 text-base-content" />
      {count && <span className="whitespace-nowrap pb-[3px] text-xs opacity-100">{count}</span>}
    </div>
  )
}

const MessageFooter: React.FC<{ data: TMessageWithUser }> = ({ data }) => {
  const countRepliedMessages = data.metadata?.replied?.length
  const createdAt = formatDate(data.created_at)

  return (
    <>
      <div className="chat-footer mt-1 flex items-center justify-end gap-2 pl-4 text-base-content">
        <div className="flex items-center gap-2">
          <ReplyIndicator count={countRepliedMessages} />
          <PinIndicator isPinned={data.metadata?.pinned} />
          <EditedIndicator isEdited={!!data.edited_at} />
          <Timestamp time={createdAt} readed_at={data.readed_at} id={data.id} />
        </div>
        {data.is_thread_root && (
          <ThreadIndicator count={data.metadata?.thread?.message_count ?? null} />
        )}
      </div>
      {data.reactions && (
        <div className="mt-1">
          <ReactionsCard reactions={data.reactions} message={data} />
        </div>
      )}
    </>
  )
}

export default MessageFooter
