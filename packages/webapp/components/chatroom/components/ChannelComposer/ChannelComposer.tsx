import { useMemo } from 'react'
import { useAuthStore, useChatStore } from '@stores'
import { useChannel } from '../../context/ChannelProvider'
import { TChannelSettings } from '@types'
import { twMerge } from 'tailwind-merge'

// Join Components
import {
  SignInToJoinChannel,
  JoinPrivateChannel,
  JoinDirectChannel,
  JoinGroupChannel,
  JoinBroadcastChannel
} from './components'

// Message Composer
import MsgComposer from '../MessageComposer/MessageComposer'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'

/**
 * Props for ChannelComposer component
 */
export interface ChannelComposerProps {
  /** Optional children to render custom content */
  children?: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Wrapper component that provides the basic container structure
 */
const ChannelComposerWrapper = ({ children, className }: ChannelComposerProps) => {
  return <div className={twMerge('channel-composer', className)}>{children}</div>
}

/**
 * Smart Access Control component that handles all channel permission logic
 * Determines what UI to show based on user permissions and channel type
 */
const AccessControl = () => {
  const { channelId } = useChatroomContext()

  const user = useAuthStore((state) => state.profile)

  // Get channel settings and permissions
  const chatChannels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => chatChannels.get(channelId) ?? null,
    [chatChannels, channelId]
  )

  const { isUserChannelMember, isUserChannelOwner, isUserChannelAdmin, channelInfo } =
    channelSettings ?? {}

  const channels = useChatStore((state: any) => state.channels)

  // Early returns for special cases
  if (!user) {
    return <ChannelComposer.SignInPrompt />
  }

  if (!channelId) {
    return null
  }

  // Thread channels always allow messaging (no permission checks needed)
  if (
    (channels.has(channelId) && channels.get(channelId).type === 'THREAD') ||
    !channelInfo ||
    channelInfo.type === 'THREAD'
  ) {
    return <MsgComposer.Editor />
  }

  // Handle different channel types with proper permission logic
  switch (channelInfo?.type) {
    case 'DIRECT':
      return isUserChannelMember ? <MsgComposer.Editor /> : <ChannelComposer.JoinDirect />

    case 'PRIVATE':
      return isUserChannelMember ? <MsgComposer.Editor /> : <ChannelComposer.JoinPrivate />

    case 'BROADCAST':
      // Owners and admins can always send messages
      if (isUserChannelOwner || isUserChannelAdmin) {
        return <MsgComposer.Editor />
      }
      // Regular members can only mute/unmute, non-members can join
      return isUserChannelMember ? <ChannelComposer.JoinBroadcast /> : <ChannelComposer.JoinGroup />

    case 'GROUP':
    case 'PUBLIC':
      return isUserChannelMember ? <MsgComposer.Editor /> : <ChannelComposer.JoinGroup />

    case 'ARCHIVE':
      // Archived channels don't allow any interaction
      return null

    default:
      // For unknown channel types, treat as public if user is member
      return isUserChannelMember ? <MsgComposer.Editor /> : <ChannelComposer.JoinGroup />
  }
}

/**
 * Main ChannelComposer component
 *
 * A compound component that handles channel access control and message composition.
 * Can be used in two ways:
 * 1. Smart mode: <ChannelComposer /> - automatically shows appropriate UI
 * 2. Manual mode: <ChannelComposer><CustomContent /></ChannelComposer>
 *
 * @example
 * // Smart mode (recommended)
 * <ChannelComposer />
 *
 * @example
 * // Manual mode with custom content
 * <ChannelComposer>
 *   <ChannelComposer.SignInPrompt />
 * </ChannelComposer>
 *
 * @example
 * // Using specific join components
 * <ChannelComposer>
 *   <ChannelComposer.JoinGroup />
 * </ChannelComposer>
 */
const ChannelComposer = ({ children, className }: ChannelComposerProps) => {
  // If children provided, use manual mode
  if (children) {
    return <ChannelComposerWrapper className={className}>{children}</ChannelComposerWrapper>
  }

  // Otherwise, use smart mode with AccessControl
  return (
    <ChannelComposerWrapper className={className}>
      <AccessControl />
    </ChannelComposerWrapper>
  )
}

// Export compound component with sub-components
export default ChannelComposer

// Join Components
ChannelComposer.SignInPrompt = SignInToJoinChannel
ChannelComposer.JoinPrivate = JoinPrivateChannel
ChannelComposer.JoinDirect = JoinDirectChannel
ChannelComposer.JoinGroup = JoinGroupChannel
ChannelComposer.JoinBroadcast = JoinBroadcastChannel

// Message Composer
ChannelComposer.MsgComposer = MsgComposer

// Smart Access Control
ChannelComposer.AccessControl = AccessControl
