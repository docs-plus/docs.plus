import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useAuthStore, useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'

import MsgComposer from '../MessageComposer/MessageComposer'
import { ChatroomComposerSkeleton } from '../skeleton'
import { JoinBroadcastChannel, JoinDirectChannel, JoinGroupChannel } from './components'

export interface ChannelComposerProps {
  children?: React.ReactNode
  className?: string
}

const ChannelComposerWrapper = ({ children, className }: ChannelComposerProps) => (
  <div className={twMerge('channel-composer w-full', className)}>{children}</div>
)

const AccessControl = () => {
  const { channelId, error, isFeedReady, variant } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )

  if (error) return null

  if (!isFeedReady) {
    return <ChatroomComposerSkeleton variant={variant} />
  }

  // No channel row yet (#402). A visitor still gets the field, so Enter opens sign-in.
  if (!channelId) return user ? null : <MsgComposer.ComposerLayout />

  const { isUserChannelMember, isUserChannelOwner, isUserChannelAdmin, channelInfo } =
    channelSettings ?? {}

  if (!channelInfo || !user) return <MsgComposer.ComposerLayout />

  switch (channelInfo.type) {
    case 'DIRECT':
      return isUserChannelMember ? <MsgComposer.ComposerLayout /> : <JoinDirectChannel />

    case 'BROADCAST':
      if (isUserChannelOwner || isUserChannelAdmin) return <MsgComposer.ComposerLayout />
      return isUserChannelMember ? <JoinBroadcastChannel /> : <JoinGroupChannel />

    case 'ARCHIVE':
      return null

    case 'GROUP':
    case 'PUBLIC':
    default:
      return isUserChannelMember ? <MsgComposer.ComposerLayout /> : <JoinGroupChannel />
  }
}

const ChannelComposer = ({ children, className }: ChannelComposerProps) => (
  <ChannelComposerWrapper className={className}>
    {children ?? <AccessControl />}
  </ChannelComposerWrapper>
)

export default ChannelComposer
