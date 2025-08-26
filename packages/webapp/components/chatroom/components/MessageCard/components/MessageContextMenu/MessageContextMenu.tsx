import { ContextMenu } from '../../../ui/ContextMenu'
import { UserReadStatus } from './components/UserReadStatus'
import { useChatStore } from '@stores'
import { useMemo } from 'react'
import { TChannelSettings } from '@types'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { ContextMenuItems } from './components/ContextMenuItems'
import { useMessageCardContext } from '../../MessageCardContext'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export const MessageContextMenu = ({ className }: Props) => {
  const { channelId } = useChatroomContext()
  const { cardRef } = useMessageCardContext()
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )
  // Do not show context menu if user is not a member of the channel
  if (!channelSettings?.isUserChannelMember) return

  return (
    <ContextMenu
      className={twMerge(
        'menu bg-base-100 z-20 m-0 w-48 rounded-lg p-2 shadow outline-none',
        className
      )}
      parrentRef={cardRef}>
      <ContextMenuItems />
      <UserReadStatus />
    </ContextMenu>
  )
}
