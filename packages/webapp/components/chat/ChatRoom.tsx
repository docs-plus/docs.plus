import React, { useState, useRef, forwardRef } from 'react'
import { MessageHeader } from './MessageHeader'
import ScrollToBottomButton from './components/chatContainer/ScrollToBottomButton' // Import the new component
import {
  useChannelInitialData,
  useMessageSubscription,
  useScrollAndLoad,
  useEmojiBoxHandler,
  useCustomEventHandler,
  useInfiniteLoadMessages
} from './hooks'
import {
  ActionBar,
  MessagesDisplay,
  LoadingOverlay,
  EmojiPickerWrapper,
  PinnedMessagesDisplay
} from './components/chatContainer'
import { twx } from '@utils/index'
import { useChannel } from './context/ChannelProvider'

const MessageWrapper = twx.div`relative flex h-full items-center justify-center bg-base-300`

import { ChannelErrorPropmpt, ChannelLoadingPrompt } from './components/prompts'

type ChatRoomProps = {
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export const ChatRoom = forwardRef(
  ({ children, style, className }: ChatRoomProps, ref: React.ForwardedRef<HTMLDivElement>) => {
    const {
      settings: { displayChannelBar, pickEmoji }
    } = useChannel()

    const [channelUsersPresence, setChannelUsersPresence] = useState(new Map())
    const [error, setError] = useState(null)
    const emojiPickerRef = useRef<HTMLDivElement | null>(null)
    const messageContainerRef = useRef<HTMLDivElement | null>(null)

    const { initialMessagesLoading, msgLength } = useChannelInitialData(setError)
    const { initialSubscribeLoading } = useMessageSubscription()
    const { loading, messagesEndRef } = useScrollAndLoad(
      initialMessagesLoading,
      messageContainerRef,
      msgLength
    )

    const {
      isEmojiBoxOpen,
      closeEmojiPicker,
      emojiPickerPosition,
      selectedEmoji,
      handleEmojiSelect,
      toggleEmojiPicker
    } = useEmojiBoxHandler(emojiPickerRef, messageContainerRef)

    useCustomEventHandler(
      channelUsersPresence,
      setChannelUsersPresence,
      messageContainerRef,
      messagesEndRef
    )

    // pagination
    const { isLoadingMore } = useInfiniteLoadMessages(messageContainerRef)

    if (error) return <ChannelErrorPropmpt />
    if (initialSubscribeLoading || initialMessagesLoading)
      return <ChannelLoadingPrompt loading={true} />

    return (
      <div className={`flex size-full flex-col overflow-y-auto ${className}`} ref={ref}>
        <MessageWrapper style={style} className="flex-1 flex-col overflow-hidden pr-1">
          {displayChannelBar && <MessageHeader />}
          <PinnedMessagesDisplay loading={loading} />
          <LoadingOverlay loading={loading} />
          <MessagesDisplay
            messageContainerRef={messageContainerRef}
            messagesEndRef={messagesEndRef}
            toggleEmojiPicker={toggleEmojiPicker}
            selectedEmoji={selectedEmoji}
            isLoadingMore={isLoadingMore}
          />
          {pickEmoji && (
            <EmojiPickerWrapper
              isEmojiBoxOpen={isEmojiBoxOpen}
              emojiPickerPosition={emojiPickerPosition}
              closeEmojiPicker={closeEmojiPicker}
              handleEmojiSelect={handleEmojiSelect}
              ref={emojiPickerRef}
            />
          )}

          <ActionBar />
          <ScrollToBottomButton messagesContainer={messageContainerRef} />
          {children}
        </MessageWrapper>
      </div>
    )
  }
)

ChatRoom.displayName = 'ChatRoom'
