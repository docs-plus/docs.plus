import { useChatStore } from '@stores'
import { ChannelProvider } from '@components/chatroom/context/ChannelProvider'
// import { ChatRoom } from '@components/chatroom/____ChatRoom____OLDDDD'
import BreadcrumbMobile from '@components/chatroom/components/BreadcrumbMobile'
import Chatroom from '@components/chatroom/Chatroom'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import { Sheet } from 'react-modal-sheet'
import { useState } from 'react'

const initSettings = {
  displayChannelBar: false,
  pickEmoji: true,
  textEditor: {
    toolbar: false,
    emojiPicker: false,
    attachmentButton: false
  },
  contextMenue: {
    replyInThread: true,
    forward: false,
    pin: false
  }
}

const ChatContainerMobile = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const { emojiPicker, closeEmojiPicker } = useChatStore()

  const handleEmojiPickerClose = () => {
    closeEmojiPicker()
  }

  if (!chatRoom?.headingId) return null

  return (
    <>
      <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
        <Chatroom variant="mobile" className="flex h-full flex-auto flex-col overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-100 py-1">
            <BreadcrumbMobile />
          </div>
          <Chatroom.MessageFeed showScrollToBottom={true}>
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
                        className={`chat-bubble px-2.5 ${message.isOwner && 'bg-chatBubble-owner before:content-[before:content-[]]'} ${!message.isGroupStart && 'ml-9 before:content-[before:content-[]]'}`}>
                        <Chatroom.MessageFeed.MessageList.MessageCard.Header.BookmarkIndicator />
                        <Chatroom.MessageFeed.MessageList.MessageCard.Header className="chat-header">
                          {!message.isOwner && message.isGroupStart && (
                            <Chatroom.MessageFeed.MessageList.MessageCard.Header.Username />
                          )}
                        </Chatroom.MessageFeed.MessageList.MessageCard.Header>

                        <Chatroom.MessageFeed.MessageList.MessageCard.Content className="">
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
                    </Chatroom.MessageFeed.MessageList.MessageCard>
                  </Chatroom.MessageFeed.MessageList.MessageCard.LongPressMenu>
                )}
              </Chatroom.MessageFeed.MessageList.Loop>
            </Chatroom.MessageFeed.MessageList>
          </Chatroom.MessageFeed>
          <Chatroom.ChannelComposer className="w-full" />
        </Chatroom>
      </ChannelProvider>

      <Sheet
        id="emojiemojiPicker_overlayer"
        className="!z-40"
        isOpen={emojiPicker.isOpen}
        onClose={handleEmojiPickerClose}
        detent="content">
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            <EmojiPanel variant="mobile">
              <EmojiPanel.Selector />
            </EmojiPanel>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={handleEmojiPickerClose} />
      </Sheet>
    </>
  )
}

export default ChatContainerMobile
