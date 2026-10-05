import { ChannelMemberReadUpdate, getChannelMembersByLastReadUpdate } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { usePeerReadSeq } from '@components/chatroom/hooks'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { AvatarStack } from '@components/ui/AvatarStack'
import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { useApi } from '@hooks/useApi'
import { Icons } from '@icons'
import { TMsgRow } from '@types'
import { toStackUser } from '@utils/avatarFace'
import { twMerge } from '@utils/twMerge'
import { useEffect, useState } from 'react'

type Props = {
  message: TMsgRow
  isOpen: boolean
}

/** The read-receipt footer of every message menu: a divider, then who has seen it. */
export function UserReadStatus({ message, isOpen }: Props) {
  const { channelId } = useChatroomContext()
  const peerReadSeq = usePeerReadSeq(channelId)
  const isSeen = typeof message.seq === 'number' && message.seq <= peerReadSeq

  const [readUsers, setReadUsers] = useState<ChannelMemberReadUpdate[]>([])
  const { request: fetchReadUsers, loading: readUsersLoading } = useApi(
    getChannelMembersByLastReadUpdate,
    [message.channel_id, message.created_at],
    false
  )

  useEffect(() => {
    const fetchData = async () => {
      if (isOpen && isSeen) {
        const { data } = await fetchReadUsers(message.channel_id, message.created_at)
        setReadUsers(data as ChannelMemberReadUpdate[])
      }
    }

    fetchData()
    // Fetch fires only when the menu opens on a seen message. The channelId and
    // created_at values are captured by closure at that moment, and stay stable
    // for the lifetime of one open-cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSeen])

  if (!isSeen) return null

  const body = readUsersLoading ? (
    <>
      <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
      <div className="skeleton h-4 w-10 rounded-full"></div>
      <AvatarStackLoader size="sm" repeat={3} className="ml-auto pr-1" />
    </>
  ) : (
    <div className="flex items-center gap-2">
      <span className="sr-only">Seen by {readUsers.length}</span>
      <span aria-hidden className="text-base-content/60 shrink-0 text-xs">
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Icons.checkDouble size={16} className="text-base-content/40" />
          {readUsers.length} seen
        </span>
      </span>
      <AvatarStack
        className="ml-auto"
        users={readUsers.map((user) => toStackUser(user))}
        size="sm"
        maxDisplay={3}
        clickable={false}
      />
    </div>
  )

  // A footer, not a menuitem, so screen readers do not count or announce it as an action.
  // No aria-label: a global attribute would undo role=none.
  return (
    <>
      <ContextMenuDivider />
      <li
        role="none"
        className={twMerge(
          'pointer-events-none px-2.5 py-2 select-none',
          readUsersLoading && 'flex flex-row items-center gap-2'
        )}>
        {body}
      </li>
    </>
  )
}
