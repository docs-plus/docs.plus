import Chatroom from '@components/chatroom/Chatroom'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import { useChatStore } from '@stores'
import { Sheet } from 'react-modal-sheet'

/**
 * Renders the chatroom inside the main BottomSheet plus an overlay
 * emoji-picker sheet for message reactions (z-40 above chatroom z-10).
 * The composer's own emoji button uses `switchSheet('emojiPicker')` instead.
 */
const ChatContainerMobile = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const { emojiPicker, closeEmojiPicker } = useChatStore()

  if (!chatRoom?.headingId) return null

  return (
    <>
      <Chatroom variant="mobile" className="flex h-full flex-auto flex-col overflow-hidden">
        {/* v2 feed renders Virtuoso-backed ChatList internally. */}
        <Chatroom.MessageFeed showScrollToBottom />
        <Chatroom.ChannelComposer className="w-full" />
      </Chatroom>

      {/* Overlay emoji picker for message reactions (sits above chatroom sheet) */}
      <Sheet
        id="emoji_picker_overlay"
        className="!z-40"
        isOpen={emojiPicker.isOpen}
        onClose={closeEmojiPicker}
        detent="content">
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            <EmojiPanel variant="mobile">
              <EmojiPanel.Selector />
            </EmojiPanel>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={closeEmojiPicker} />
      </Sheet>
    </>
  )
}

export default ChatContainerMobile
