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

  // null until the first read lands, so the first frame shows the bones, not "0 seen".
  const [readUsers, setReadUsers] = useState<ChannelMemberReadUpdate[] | null>(null)
  const [failed, setFailed] = useState(false)
  const { request: fetchReadUsers } = useApi(
    getChannelMembersByLastReadUpdate,
    [message.channel_id, message.created_at],
    false
  )

  useEffect(() => {
    if (!isSeen) return
    let cancelled = false
    fetchReadUsers(message.channel_id, message.created_at)
      .then(({ data }) => {
        if (!cancelled) setReadUsers((data as ChannelMemberReadUpdate[]) ?? [])
      })
      // useApi logs and rethrows. The footer cannot hold a retry, so a failure hides it.
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [isSeen, fetchReadUsers, message.channel_id, message.created_at])

  if (!isSeen || failed) return null

  // A footer, not a menuitem, so screen readers do not count or announce it as an action.
  // No aria-label: a global attribute would undo role=none.
  return (
    <>
      <ContextMenuDivider />
      <li role="none" className="pointer-events-none px-2.5 py-2 select-none">
        <div className="flex items-center gap-2">
          {readUsers && <span className="sr-only">Seen by {readUsers.length}</span>}
          <span aria-hidden className="text-base-content/60 shrink-0 text-xs">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Icons.checkDouble size={16} className="text-base-content/40" />
              {readUsers ? `${readUsers.length} seen` : <span className="skeleton h-3 w-10" />}
            </span>
          </span>
          {readUsers ? (
            <AvatarStack
              className="ml-auto"
              users={readUsers.map((user) => toStackUser(user))}
              size="sm"
              maxDisplay={3}
              clickable={false}
            />
          ) : (
            <AvatarStackLoader size="sm" repeat={3} className="ml-auto" />
          )}
        </div>
      </li>
    </>
  )
}
