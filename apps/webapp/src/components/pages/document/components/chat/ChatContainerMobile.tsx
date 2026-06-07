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
    <div className="flex h-full flex-col">
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
