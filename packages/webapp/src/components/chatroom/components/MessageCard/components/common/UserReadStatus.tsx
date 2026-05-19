import { ChannelMemberReadUpdate, getChannelMembersByLastReadUpdate } from '@api'
import AvatarStack from '@components/AvatarStack'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { usePeerReadSeq } from '@components/chatroom/hooks'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { MenuItem } from '@components/ui/ContextMenu'
import { useApi } from '@hooks/useApi'
import { Icons } from '@icons'
import { TMsgRow } from '@types'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  message: TMsgRow
  isOpen: boolean
  wrapper?: 'li' | 'MenuItem'
  avatarLoaderRepeat?: number
  className?: string
}

export const UserReadStatus = ({
  message,
  isOpen,
  wrapper = 'MenuItem',
  avatarLoaderRepeat = 3,
  className
}: Props) => {
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
      if (isOpen) {
        const { data } = await fetchReadUsers(channelId, message.created_at)
        setReadUsers(data as ChannelMemberReadUpdate[])
      }
    }

    fetchData()
    // Fetch fires only when the menu opens; channelId / created_at are
    // captured by closure at that moment and are stable for the lifetime
    // of one open-cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isSeen) return null

  const content = (
    <div className={twMerge('flex items-center gap-2 pt-2', className)}>
      <span className="text-base-content/50 shrink-0 text-xs">
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Icons.checkDouble size={16} className="text-base-content/40" />
          {readUsers.length} seen
        </span>
      </span>

      <AvatarStack
        className="ml-auto"
        users={(readUsers as ChannelMemberReadUpdate[]).map((user) => ({
          id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          avatar_updated_at: user.avatar_updated_at
        }))}
        size="sm"
        maxDisplay={3}
      />
    </div>
  )

  const loadingContent = (
    <>
      <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
      <div className="skeleton h-4 w-10 rounded-full"></div>
      <AvatarStackLoader size="sm" repeat={avatarLoaderRepeat} className="ml-auto pr-1" />
    </>
  )

  const wrapperProps = {
    className: readUsersLoading
      ? 'menu-disabled flex flex-row items-center gap-2 '
      : 'menu-disabled'
  }

  if (wrapper === 'li') {
    return <li {...wrapperProps}>{readUsersLoading ? loadingContent : content}</li>
  }

  return <MenuItem {...wrapperProps}>{readUsersLoading ? loadingContent : content}</MenuItem>
}
