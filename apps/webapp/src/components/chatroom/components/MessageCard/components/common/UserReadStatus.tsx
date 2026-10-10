import { ChannelMemberReadUpdate, getChannelMembersByLastReadUpdate } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { usePeerReadSeq } from '@components/chatroom/hooks'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { AvatarStack } from '@components/ui/AvatarStack'
import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { Icons } from '@icons'
import { useQuery } from '@tanstack/react-query'
import { TMsgRow } from '@types'
import { toStackUser } from '@utils/avatarFace'

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

  // gcTime 0 drops the answer on close, so each open fetches again and shows the bones first.
  const { data: readUsers, isError } = useQuery({
    queryKey: ['read-users', message.channel_id, message.created_at],
    queryFn: async () => {
      const { data, error } = await getChannelMembersByLastReadUpdate(
        message.channel_id,
        message.created_at
      )
      if (error) throw error
      // The API wrapper types the rows as `PostgrestResponse<T[]>`, one array too deep.
      return (data ?? []) as unknown as ChannelMemberReadUpdate[]
    },
    enabled: isSeen,
    gcTime: 0,
    retry: false
  })

  // The footer cannot hold a retry, so a failure hides it.
  if (!isSeen || isError) return null

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
