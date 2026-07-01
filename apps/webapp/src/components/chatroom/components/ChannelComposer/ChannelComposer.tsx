import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useAuthStore, useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

import MsgComposer from '../MessageComposer/MessageComposer'
import { ChatroomComposerSkeleton } from '../skeleton'
import {
  JoinBroadcastChannel,
  JoinDirectChannel,
  JoinGroupChannel,
  JoinPrivateChannel,
  SignInToJoinChannel
} from './components'

export interface ChannelComposerProps {
  children?: React.ReactNode
  className?: string
}

const ChannelComposerWrapper = ({ children, className }: ChannelComposerProps) => (
  <div className={twMerge('channel-composer w-full', className)}>{children}</div>
)

const AccessControl = () => {
  const { channelId, isFeedReady, variant } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )

  if (!channelId) return null

  if (!isFeedReady) {
    return <ChatroomComposerSkeleton variant={variant} />
  }

  const { isUserChannelMember, isUserChannelOwner, isUserChannelAdmin, channelInfo } =
    channelSettings ?? {}

  if (!channelInfo || !user) return <MsgComposer.ComposerLayout />

  switch (channelInfo.type) {
    case 'DIRECT':
      return isUserChannelMember ? <MsgComposer.ComposerLayout /> : <ChannelComposer.JoinDirect />

    case 'PRIVATE':
      return isUserChannelMember ? <MsgComposer.ComposerLayout /> : <ChannelComposer.JoinPrivate />

    case 'BROADCAST':
      if (isUserChannelOwner || isUserChannelAdmin) return <MsgComposer.ComposerLayout />
      return isUserChannelMember ? <ChannelComposer.JoinBroadcast /> : <ChannelComposer.JoinGroup />

    case 'ARCHIVE':
      return null

    case 'GROUP':
    case 'PUBLIC':
    default:
      return isUserChannelMember ? <MsgComposer.ComposerLayout /> : <ChannelComposer.JoinGroup />
  }
}

const ChannelComposer = ({ children, className }: ChannelComposerProps) => (
  <ChannelComposerWrapper className={className}>
    {children ?? <AccessControl />}
  </ChannelComposerWrapper>
)

export default ChannelComposer

ChannelComposer.SignInPrompt = SignInToJoinChannel
ChannelComposer.JoinPrivate = JoinPrivateChannel
ChannelComposer.JoinDirect = JoinDirectChannel
ChannelComposer.JoinGroup = JoinGroupChannel
ChannelComposer.JoinBroadcast = JoinBroadcastChannel
ChannelComposer.MsgComposer = MsgComposer
ChannelComposer.AccessControl = AccessControl
