import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useAuthStore, useChatStore, useStore } from '@stores'
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
  const { channelId, error, isChannelDataLoaded, isFeedReady, variant } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const joinedWorkspace = useStore((state) => state.settings.joinedWorkspace) ?? false
  const joinFailed = useStore((state) => state.settings.joinWorkspaceFailed) ?? false
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )

  if (error) return null

  const skeleton = <ChatroomComposerSkeleton variant={variant} />
  if (!isChannelDataLoaded) return skeleton
  // A late workspace join auto-joins the channel, so membership is not final yet. With no
  // channel row (#402), the join's retry may create one (useHeadingChannel). A failed join
  // ends the wait, so the composer below falls back to the Join surface or nothing.
  if (user && !joinedWorkspace && !joinFailed && (!isFeedReady || !channelId)) return skeleton

  // Membership is known once the channel data lands, so a Join surface paints then.
  // Only the live field waits for the feed.
  const composer = isFeedReady ? <MsgComposer.ComposerLayout /> : skeleton

  // A visitor still gets the field, so Enter opens sign-in. For a signed-in user, a row
  // still missing after the retry is final, so the composer ends.
  if (!channelId) return user ? null : composer

  const { isUserChannelMember, isUserChannelOwner, isUserChannelAdmin, channelInfo } =
    channelSettings ?? {}

  if (!channelInfo || !user) return composer

  switch (channelInfo.type) {
    case 'DIRECT':
      return isUserChannelMember ? composer : <JoinDirectChannel />

    case 'BROADCAST':
      if (isUserChannelOwner || isUserChannelAdmin) return composer
      return isUserChannelMember ? <JoinBroadcastChannel /> : <JoinGroupChannel />

    case 'ARCHIVE':
      return null

    case 'GROUP':
    case 'PUBLIC':
    default:
      return isUserChannelMember ? composer : <JoinGroupChannel />
  }
}

const ChannelComposer = ({ children, className }: ChannelComposerProps) => (
  <ChannelComposerWrapper className={className}>
    {children ?? <AccessControl />}
  </ChannelComposerWrapper>
)

export default ChannelComposer
