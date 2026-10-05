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
}

/**
 * The read-receipt footer of every message menu: a divider, then who has seen it.
 * It mounts only while its menu is open, so the fetch runs once per open.
 */
export function UserReadStatus({ message }: Props) {
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
    if (!isSeen) return
    const fetchData = async () => {
      const { data } = await fetchReadUsers(message.channel_id, message.created_at)
      setReadUsers(data as ChannelMemberReadUpdate[])
    }

    fetchData()
  }, [isSeen, fetchReadUsers, message.channel_id, message.created_at])

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
