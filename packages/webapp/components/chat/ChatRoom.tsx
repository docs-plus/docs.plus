import React, { useState, useRef, forwardRef, useEffect } from 'react'
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

const MessageWrapper = twx.div`relative flex h-full items-center justify-center bg-white`

import { ChannelErrorPropmpt, ChannelLoadingPrompt } from './components/prompts'
import { useStore } from '@stores'

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

    const {
      settings: {
        editor: { isMobile }
      }
    } = useStore((state) => state)

    const [channelUsersPresence, setChannelUsersPresence] = useState(new Map())
    const [error, setError] = useState(null)
    const emojiPickerRef = useRef<HTMLDivElement | null>(null)
    const messageContainerRef = useRef<HTMLDivElement>(null)

    const { isChannelDataLoaded } = useChannelInitialData(setError)
    // subscribe to channel, and listen to channel and message postgres_changes
    const { isDbSubscriptionReady } = useMessageSubscription()

    // pagination
    const { isLoadingMore, loadingMoreDirection } = useInfiniteLoadMessages(messageContainerRef)

    const { isReadyToDisplayMessages, messagesEndRef } = useScrollAndLoad(
      isChannelDataLoaded,
      isDbSubscriptionReady,
      messageContainerRef,
      isLoadingMore
    )

    const {
      isEmojiBoxOpen,
      closeEmojiPicker,
      emojiPickerPosition,
      selectedEmoji,
      handleEmojiSelect,
      toggleEmojiPicker
    } = useEmojiBoxHandler(emojiPickerRef, messageContainerRef)

    // custom event handler for users presence
    useCustomEventHandler(channelUsersPresence, setChannelUsersPresence)

    if (error) return <ChannelErrorPropmpt />

    return (
      <div className={`flex size-full flex-col overflow-y-auto ${className}`} ref={ref}>
        <MessageWrapper style={style} className="flex-1 flex-col overflow-hidden">
          {displayChannelBar && <MessageHeader />}
          <PinnedMessagesDisplay loading={!isReadyToDisplayMessages} />
          <LoadingOverlay
            loading={!isDbSubscriptionReady || !isChannelDataLoaded || !isReadyToDisplayMessages}
          />
          <MessagesDisplay
            messageContainerRef={messageContainerRef}
            messagesEndRef={messagesEndRef}
            toggleEmojiPicker={toggleEmojiPicker}
            selectedEmoji={selectedEmoji}
            isLoadingMore={isLoadingMore}
            loadingMoreDirection={loadingMoreDirection}
          />

          <div className="flex w-full flex-col items-center justify-center bg-transparent">
            {(!isMobile || (isMobile && !isEmojiBoxOpen)) && <ActionBar />}
            {pickEmoji && (
              <EmojiPickerWrapper
                isEmojiBoxOpen={isEmojiBoxOpen}
                emojiPickerPosition={emojiPickerPosition}
                closeEmojiPicker={closeEmojiPicker}
                handleEmojiSelect={handleEmojiSelect}
                ref={emojiPickerRef}
              />
            )}
          </div>

          <ScrollToBottomButton messagesContainer={messageContainerRef} />
          {children}
        </MessageWrapper>
      </div>
    )
  }
)

ChatRoom.displayName = 'ChatRoom'
