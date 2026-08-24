import Chatroom from '@components/chatroom/Chatroom'
import MsgComposer from '@components/chatroom/components/MessageComposer/MessageComposer'
import { useComposerEmojiPanelStore } from '@components/chatroom/components/MessageComposer/stores/composerEmojiPanelStore'
import { closeMessageReaction } from '@components/chatroom/utils/messageReaction'
import { useChatStore } from '@stores'
import { useEffect } from 'react'

const ChatContainerMobile = () => {
  const headingId = useChatStore((state) => state.chatRoom.headingId)

  useEffect(() => {
    return () => {
      const paneClosed = useChatStore.getState().chatRoom.paneMode === 'closed'
      useComposerEmojiPanelStore.getState().close({ consumeHistory: !paneClosed })
      closeMessageReaction()
    }
  }, [headingId])

  if (!headingId) return null

  return (
    // True last-in-flow element. This element carries the safe-area inset, so the inset
    // stays reserved beneath whichever child renders last. Chatroom and ComposerEmojiPanel
    // are siblings, and the composer alone can't know which is visually at the bottom.
    // ChatPane reads `data-chat-pane-body` to fold this inset into its height clamp.
    <div
      data-chat-pane-body
      className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)]">
      <Chatroom variant="mobile" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chatroom.MessageFeed showScrollToBottom />
        <Chatroom.ChannelComposer className="w-full" />
      </Chatroom>
      <MsgComposer.ComposerEmojiPanel />
    </div>
  )
}

export default ChatContainerMobile
