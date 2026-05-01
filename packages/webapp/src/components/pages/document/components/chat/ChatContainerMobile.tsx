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
        <Chatroom.MessageFeed showScrollToBottom>
          <Chatroom.MessageFeed.MessageList className="overflow-x-hidden">
            <Chatroom.MessageFeed.MessageList.Loop>
              {(message, index) => (
                <Chatroom.MessageFeed.MessageList.MessageCard.LongPressMenu message={message}>
                  <Chatroom.MessageFeed.MessageList.MessageCard
                    className="max-w-[90%] min-w-[80%] sm:min-w-[250px]"
                    message={message}
                    index={index}>
                    {message.isGroupStart && !message.isOwner && (
                      <div className="chat-image avatar">
                        <Chatroom.MessageFeed.MessageList.MessageCard.Header.UserAvatar />
                      </div>
                    )}

                    <div
                      className={`chat-bubble px-2.5 ${
                        message.isOwner ? 'bg-primary/20 before:hidden' : ''
                      } ${!message.isGroupStart ? 'ml-9 before:hidden' : ''}`}>
                      <Chatroom.MessageFeed.MessageList.MessageCard.Header.BookmarkIndicator />
                      <Chatroom.MessageFeed.MessageList.MessageCard.Header className="chat-header">
                        {!message.isOwner && message.isGroupStart && (
                          <Chatroom.MessageFeed.MessageList.MessageCard.Header.Username />
                        )}
                      </Chatroom.MessageFeed.MessageList.MessageCard.Header>

                      <Chatroom.MessageFeed.MessageList.MessageCard.Content>
                        <Chatroom.MessageFeed.MessageList.MessageCard.Content.ReplyReference />
                        <Chatroom.MessageFeed.MessageList.MessageCard.Content.CommentReference />
                        <Chatroom.MessageFeed.MessageList.MessageCard.Content.MessageBody />
                      </Chatroom.MessageFeed.MessageList.MessageCard.Content>

                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer className="chat-footer justify-end">
                        <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions>
                          <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.ReactionList />
                        </Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions>
                        <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators className="pr-0">
                          <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge />
                          <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.ReplyCount />
                          <Chatroom.MessageFeed.MessageList.MessageCard.Header.Timestamp />
                          <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.MessageSeen />
                        </Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators>
                      </Chatroom.MessageFeed.MessageList.MessageCard.Footer>
                    </div>
                    <Chatroom.MessageFeed.MessageList.MessageCard.FailedRow
                      className={message.isOwner ? 'self-end pr-2' : 'self-start pl-2'}
                    />
                  </Chatroom.MessageFeed.MessageList.MessageCard>
                </Chatroom.MessageFeed.MessageList.MessageCard.LongPressMenu>
              )}
            </Chatroom.MessageFeed.MessageList.Loop>
          </Chatroom.MessageFeed.MessageList>
        </Chatroom.MessageFeed>
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
