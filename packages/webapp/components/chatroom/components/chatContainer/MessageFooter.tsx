import React from 'react'
import { CgMailReply } from 'react-icons/cg'
import { TbPinned } from 'react-icons/tb'

import ReactionsCard from './ReactionsCard'
import { IoCheckmarkDoneSharp, IoTimeOutline, IoCheckmarkSharp } from 'react-icons/io5'
import { BiSolidMessageDetail } from 'react-icons/bi'
import { TMessageWithUser } from '@api'
import MessageReaction from '@components/chatroom/MessageReaction'

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
  isPinned ? <TbPinned className="text-base-content size-4 rotate-45" /> : null

const EditedIndicator = ({ isEdited }: { isEdited?: boolean }) =>
  isEdited ? <span className="text-base-content text-opacity-50 text-xs">edited</span> : null

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
    <div className="bg-base-100/10 flex space-x-1 rounded px-1">
      <time className="text-xs whitespace-nowrap opacity-50">{time}</time>
      {id === 'fake_id' && <IoTimeOutline className="text-base-content size-4" />}
      <div className={id !== 'fake_id' ? 'block' : 'hidden'}>
        {!readed_at ? <IoCheckmarkSharp className="text-base-content size-4" /> : null}
        {readed_at ? <IoCheckmarkDoneSharp className="text-base-content size-4" /> : null}
      </div>
    </div>
  )
}

const ThreadIndicator = ({ count }: { count: number | null }) => {
  if (!count) return
  return (
    <div className="bg-base-100/10 flex items-center justify-between space-x-1 rounded px-1">
      <BiSolidMessageDetail className="text-base-content size-4" />
      {count && <span className="pb-[3px] text-xs whitespace-nowrap opacity-100">{count}</span>}
    </div>
  )
}

const CardIndicators = ({ data }: { data: TMessageWithUser }) => {
  const countRepliedMessages = data.metadata?.replied?.length
  const createdAt = formatDate(data.created_at)
  return (
    <div className={`chat-footer text-base-content mt-1 flex items-center justify-end gap-2`}>
      <MessageReaction message={data} className="mr-auto" />
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
  )
}

const MessageFooter: React.FC<{ data: TMessageWithUser }> = ({ data }) => {
  const countRepliedMessages = data.metadata?.replied?.length
  const createdAt = formatDate(data.created_at)

  return (
    <>
      {!data.reactions && <CardIndicators data={data} />}
      {data.reactions && (
        <div className="">
          <ReactionsCard reactions={data.reactions} message={data}>
            <div className="flex items-center gap-2">
              <ReplyIndicator count={countRepliedMessages} />
              <PinIndicator isPinned={data.metadata?.pinned} />
              <EditedIndicator isEdited={!!data.edited_at} />
              <Timestamp time={createdAt} readed_at={data.readed_at} id={data.id} />
            </div>
          </ReactionsCard>
        </div>
      )}
    </>
  )
}

export default MessageFooter
