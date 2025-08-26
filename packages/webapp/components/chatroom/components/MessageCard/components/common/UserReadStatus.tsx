import { ChannelMemberReadUpdate, getChannelMembersByLastReadUpdate } from '@api'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { MenuItem } from '@components/chatroom/components/ui/ContextMenu'
import { useApi } from '@hooks/useApi'
import { useEffect, useState, ReactNode } from 'react'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { IoCheckmarkDoneSharp, IoCheckmarkSharp } from 'react-icons/io5'
import AvatarStack from '@components/AvatarStack'
import { TMsgRow } from '@types'

type Props = {
  message: TMsgRow
  isOpen: boolean
  wrapper?: 'li' | 'MenuItem'
  avatarLoaderRepeat?: number
}

export const UserReadStatus = ({
  message,
  isOpen,
  wrapper = 'MenuItem',
  avatarLoaderRepeat = 3
}: Props) => {
  const { channelId } = useChatroomContext()

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
  }, [isOpen])

  if (!message.readed_at) return null

  const content = (
    <div className="flex items-center gap-2 py-0 pt-2">
      <span className="text-xs text-gray-500">
        {!message.readed_at ? (
          <IoCheckmarkSharp className="text-base-content size-4 text-gray-400" />
        ) : (
          <span className="flex items-center gap-3">
            <IoCheckmarkDoneSharp className="text-base-content size-4 text-gray-400" />
            {readUsers.length} seen
          </span>
        )}
      </span>

      <AvatarStack
        className="ml-auto !-space-x-4"
        users={(readUsers as ChannelMemberReadUpdate[]).map((user) => ({
          id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          avatar_updated_at: user.avatar_updated_at
        }))}
        size={8}
        maxDisplay={5}
      />
    </div>
  )

  const loadingContent = (
    <>
      <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
      <div className="skeleton h-4 w-10 rounded-full"></div>
      <AvatarStackLoader
        size={7}
        repeat={avatarLoaderRepeat}
        className="ml-auto !-space-x-6 pr-1"
      />
    </>
  )

  const wrapperProps = {
    className: readUsersLoading
      ? 'menu-disabled flex flex-row items-center gap-2 border-t border-gray-300'
      : 'menu-disabled !my-1 border-t border-gray-300'
  }

  if (wrapper === 'li') {
    return <li {...wrapperProps}>{readUsersLoading ? loadingContent : content}</li>
  }

  return <MenuItem {...wrapperProps}>{readUsersLoading ? loadingContent : content}</MenuItem>
}
