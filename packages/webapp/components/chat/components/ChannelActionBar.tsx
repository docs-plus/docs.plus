import { useMemo } from 'react'
import JoinBroadcastChannel from './JoinBroadcastChannel'
import JoinGroupChannel from './JoinGroupChannel'
import JoinPrivateChannel from './JoinDirectChannel'
import JoinDirectChannel from './JoinPrivateChannel'
import { useAuthStore, useChatStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'
import SignInToJoinChannel from './SignInToJoinChannel'
import { TChannelSettings } from '@types'
import MessageComposer from './MessageComposer/MessageComposer'

const SendMessage = () => {
  return (
    <MessageComposer className="chat_editor_container mb-2 flex w-full flex-col">
      <MessageComposer.Context>
        <MessageComposer.ReplyContext />
        <MessageComposer.EditContext />
        <MessageComposer.CommentContext />
      </MessageComposer.Context>
      <div className="rounded-md border border-gray-300 bg-transparent shadow-md">
        <MessageComposer.Toolbar className="bg-base-300/60 h-10 rounded-t-md border-b p-2 px-1">
          <MessageComposer.BoldButton size={10} />
          <MessageComposer.ItalicButton size={10} />
          <MessageComposer.StrikethroughButton size={14} />
          <div className="divided" />
          <MessageComposer.HyperlinkButton size={18} />
          <MessageComposer.BulletListButton size={16} />
          <MessageComposer.OrderedListButton size={16} />
          <div className="divided" />
          <MessageComposer.BlockquoteButton size={20} />
          <MessageComposer.CodeButton size={20} />
          <MessageComposer.CodeBlockButton size={20} />
        </MessageComposer.Toolbar>

        <MessageComposer.Input />

        <MessageComposer.Actions>
          <MessageComposer.ToggleToolbarButton />
          <MessageComposer.EmojiButton />
          <MessageComposer.MentionButton />
          <MessageComposer.SendButton />
        </MessageComposer.Actions>
      </div>
    </MessageComposer>
  )
}

export const ChannelActionBar = () => {
  const { channelId } = useChannel()
  const user = useAuthStore((state: any) => state.profile)

  const chatChannels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => chatChannels.get(channelId) ?? null,
    [chatChannels, channelId]
  )

  const { isUserChannelMember, isUserChannelOwner, isUserChannelAdmin, channelInfo } =
    channelSettings ?? {}

  const channels = useChatStore((state: any) => state.channels)

  if (!user) return <SignInToJoinChannel />

  if (
    (channels.has(channelId) && channels.get(channelId).type === 'THREAD') ||
    !channelInfo ||
    channelInfo.type === 'THREAD'
  ) {
    return <SendMessage />
  }

  // For DIRECT, PRIVATE and default cases
  if (['DIRECT', 'PRIVATE'].includes(channelInfo?.type) || !channelInfo?.type) {
    if (isUserChannelMember) {
      return <SendMessage />
    } else if (channelInfo?.type === 'PRIVATE') {
      return <JoinPrivateChannel />
    } else {
      return <JoinDirectChannel />
    }
  }

  // Specific logic for BROADCAST
  if (channelInfo?.type === 'BROADCAST') {
    if (isUserChannelOwner || isUserChannelAdmin) {
      return <SendMessage />
    }
    return isUserChannelMember ? <JoinBroadcastChannel /> : <JoinGroupChannel />
  }

  // For GROUP and PUBLIC cases
  if (['GROUP', 'PUBLIC'].includes(channelInfo?.type)) {
    return isUserChannelMember ? <SendMessage /> : <JoinGroupChannel />
  }

  // For ARCHIVE
  if (channelInfo?.type === 'ARCHIVE') {
    return ''
  }
}
