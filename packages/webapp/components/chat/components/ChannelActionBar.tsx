import { useMemo } from 'react'
import JoinBroadcastChannel from './JoinBroadcastChannel'
import JoinGroupChannel from './JoinGroupChannel'
import JoinPrivateChannel from './JoinDirectChannel'
import JoinDirectChannel from './JoinPrivateChannel'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'
import SignInToJoinChannel from './SignInToJoinChannel'
import { TChannelSettings } from '@types'
import MessageComposer from './MessageComposer/MessageComposer'
import useKeyboardHeight from '@hooks/useKeyboardHeight'
import { useMessageComposer } from './MessageComposer/hooks/useMessageComposer'

const MobileToolbar = () => {
  const { isOpen: isKeyboardOpen } = useKeyboardHeight()
  const { isToolbarOpen, toggleToolbar } = useMessageComposer()

  if (!isKeyboardOpen) return null

  return (
    <div className="relative h-10 overflow-hidden">
      <div
        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
          isToolbarOpen ? 'translate-y-0' : '-translate-y-full'
        }`}>
        <MessageComposer.Actions>
          <MessageComposer.ToggleToolbarButton />
          <MessageComposer.EmojiButton />
          <MessageComposer.MentionButton />
          <MessageComposer.SendButton />
        </MessageComposer.Actions>
      </div>

      <div
        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
          isToolbarOpen ? 'translate-y-full' : 'translate-y-0'
        }`}>
        <MessageComposer.Toolbar className="bg-base-200 h-full border-b p-2 px-1">
          <MessageComposer.ToggleToolbarButton
            iconType="Close"
            onPress={toggleToolbar}
            size={22}
            className="btn-square !bg-gray-200"
          />
          <div className="divided m-0 w-0" />
          <div className="flex snap-x items-center gap-1 overflow-x-scroll overflow-y-hidden">
            <MessageComposer.BoldButton size={10} className="snap-center" />
            <MessageComposer.ItalicButton size={10} className="snap-center" />
            <MessageComposer.StrikethroughButton size={14} className="snap-center" />
            <MessageComposer.HyperlinkButton size={18} className="snap-center" />
            <MessageComposer.BulletListButton size={16} className="snap-center" />
            <MessageComposer.OrderedListButton size={16} className="snap-center" />
            <MessageComposer.BlockquoteButton size={20} className="snap-center" />
            <MessageComposer.CodeButton size={20} className="snap-center" />
            <MessageComposer.CodeBlockButton size={20} className="snap-center" />
          </div>
        </MessageComposer.Toolbar>
      </div>
    </div>
  )
}

const SendMessage = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  if (isMobile)
    return (
      <div className="chat_editor_container flex w-full flex-col">
        <MessageComposer className="rounded-t-md border border-b-0 border-gray-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <MessageComposer.MobileWrapper>
            <MessageComposer.Context>
              <MessageComposer.ReplyContext />
              <MessageComposer.EditContext />
              <MessageComposer.CommentContext />
            </MessageComposer.Context>

            <div className="flex flex-row items-center gap-2 px-2 py-1.5">
              <MessageComposer.AttachmentButton size={22} className="btn-square bg-gray-200" />
              <MessageComposer.Input />
            </div>
            <MobileToolbar />
          </MessageComposer.MobileWrapper>
        </MessageComposer>
      </div>
    )
  return (
    <MessageComposer className="chat_editor_container m-auto mb-2 flex w-[98%] flex-col">
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
