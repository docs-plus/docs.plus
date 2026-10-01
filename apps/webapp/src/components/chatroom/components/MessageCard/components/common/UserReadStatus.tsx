import { ChannelMemberReadUpdate, getChannelMembersByLastReadUpdate } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { usePeerReadSeq } from '@components/chatroom/hooks'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { AvatarStack } from '@components/ui/AvatarStack'
import { useApi } from '@hooks/useApi'
import { Icons } from '@icons'
import { TMsgRow } from '@types'
import { toStackUser } from '@utils/avatarFace'
import { twMerge } from '@utils/twMerge'
import { useEffect, useState } from 'react'

export function useIsMessageSeenByPeers(message: TMsgRow) {
  const { channelId } = useChatroomContext()
  const peerReadSeq = usePeerReadSeq(channelId)
  return typeof message.seq === 'number' && message.seq <= peerReadSeq
}

type Props = {
  message: TMsgRow
  isOpen: boolean
  avatarLoaderRepeat?: number
  className?: string
  /** Inside a `role="menu"` list, a plain `li` is not an allowed child. */
  inMenu?: boolean
}

export function UserReadStatus({
  message,
  isOpen,
  avatarLoaderRepeat = 3,
  className,
  inMenu = false
}: Props) {
  const isSeen = useIsMessageSeenByPeers(message)

  const [readUsers, setReadUsers] = useState<ChannelMemberReadUpdate[]>([])
  const { request: fetchReadUsers, loading: readUsersLoading } = useApi(
    getChannelMembersByLastReadUpdate,
    [message.channel_id, message.created_at],
    false
  )

  useEffect(() => {
    const fetchData = async () => {
      if (isOpen) {
        const { data } = await fetchReadUsers(message.channel_id, message.created_at)
        setReadUsers(data as ChannelMemberReadUpdate[])
      }
    }

    fetchData()
    // Fetch fires only when the menu opens. The channelId and created_at values
    // are captured by closure at that moment, and stay stable for the lifetime
    // of one open-cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isSeen) return null

  const body = readUsersLoading ? (
    <>
      <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
      <div className="skeleton h-4 w-10 rounded-full"></div>
      <AvatarStackLoader size="sm" repeat={avatarLoaderRepeat} className="ml-auto pr-1" />
    </>
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-base-content/60 shrink-0 text-xs">
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

  return (
    <li
      role={inMenu ? 'menuitem' : undefined}
      aria-disabled={inMenu || undefined}
      className={twMerge(
        'pointer-events-none px-2.5 py-2 select-none',
        readUsersLoading && 'flex flex-row items-center gap-2',
        className
      )}>
      {body}
    </li>
  )
}
