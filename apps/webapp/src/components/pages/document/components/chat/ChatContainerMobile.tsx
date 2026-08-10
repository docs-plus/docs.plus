import { emojiReaction } from '@api'
import Chatroom from '@components/chatroom/Chatroom'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import MsgComposer from '@components/chatroom/components/MessageComposer/MessageComposer'
import { useComposerEmojiPanelStore } from '@components/chatroom/components/MessageComposer/stores/composerEmojiPanelStore'
import { useChatStore } from '@stores'
import { useCallback, useEffect } from 'react'
import { Sheet } from 'react-modal-sheet'

/**
 * Mobile chatroom container. Holds the Chatroom, the inline composer
 * emoji panel, and the independent reaction overlay sheet.
 */
const ChatContainerMobile = () => {
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const isEmojiPickerOpen = useChatStore((s) => s.emojiPicker.isOpen)
  const closeEmojiPicker = useChatStore((s) => s.closeEmojiPicker)

  // Panel store is module-global; close it so open state doesn't leak
  // across heading switches.
  useEffect(() => {
    return () => useComposerEmojiPanelStore.getState().close()
  }, [headingId])

  const handleReactionSelect = useCallback((native: string) => {
    const chat = useChatStore.getState()
    emojiReaction(chat.emojiPicker.selectedMessage, native)
    chat.closeEmojiPicker()
  }, [])

  if (!headingId) return null

  return (
    // True last-in-flow element. This element carries the safe-area inset, so the inset
    // stays reserved beneath whichever child renders last. Chatroom and ComposerEmojiPanel
    // are siblings, and the composer alone can't know which is visually at the bottom.
    // ChatPane reads `data-chat-pane-body` to fold this inset into its height clamp.
    <div data-chat-pane-body className="flex h-full flex-col pb-[env(safe-area-inset-bottom,0px)]">
      <Chatroom variant="mobile" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chatroom.MessageFeed showScrollToBottom />
        <Chatroom.ChannelComposer className="w-full" />
      </Chatroom>
      <MsgComposer.ComposerEmojiPanel />

      <Sheet
        id="emoji_picker_overlay"
        className="!z-40"
        isOpen={isEmojiPickerOpen}
        onClose={closeEmojiPicker}
        detent="content">
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            <EmojiPanel variant="mobile" onSelect={handleReactionSelect}>
              <EmojiPanel.Selector />
            </EmojiPanel>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={closeEmojiPicker} />
      </Sheet>
    </div>
  )
}

export default ChatContainerMobile
