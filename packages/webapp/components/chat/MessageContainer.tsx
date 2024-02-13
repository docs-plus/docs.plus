import React, { useState, useRef } from 'react'
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
  MessagesDisplay,
  LoadingOverlay,
  EmojiPickerWrapper,
  PinnedMessagesDisplay
} from './components/chatContainer'
import { ChannelActionBar } from './components/ChannelActionBar'

import Toolbar from './components/Toolbar'

import { twx } from '@utils/twx'

const MessageWrapper = twx.div`relative flex w-full max-w-full max-w-full items-center justify-center bg-base-300`

export default function MessageContainer({}: any) {
  const [channelUsersPresence, setChannelUsersPresence] = useState(new Map())
  const [error, setError] = useState(null)
  const emojiPickerRef = useRef<HTMLDivElement | null>(null)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)

  // get user session and profile
  // get channel initial data, includes pinned messages, last messages and channel members count
  // TODO: we need to consider the last message loaded, and when the user subscribe to the channel, we need to load the messages after the last message loaded
  const { initialMessagesLoading, msgLength } = useChannelInitialData(setError)
  // return <>Hello World</>

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
  const { isLoadingMore } = useInfiniteLoadMessages(messageContainerRef)

  if (error) {
    return (
      <MessageWrapper className="flex-col justify-start">
        <Toolbar />
        <div className='className="relative flex items-center justify-center w-full h-full overflow-auto flex-col px-10 pt-1"'>
          <div className="badge badge-error">Error loading messages...</div>
        </div>
      </MessageWrapper>
    )
  }

  if (initialSubscribeLoading || initialMessagesLoading)
    return (
      <MessageWrapper className="flex-col justify-start">
        <Toolbar />
        <LoadingOverlay loading={true} />
      </MessageWrapper>
    )

  return (
    <MessageWrapper className="flex-col h-full justify-start">
      {/* <MessageHeader /> */}
      <Toolbar />
      <PinnedMessagesDisplay loading={loading} />
      <LoadingOverlay loading={loading} />
      <MessagesDisplay
        messageContainerRef={messageContainerRef}
        messagesEndRef={messagesEndRef}
        toggleEmojiPicker={toggleEmojiPicker}
        selectedEmoji={selectedEmoji}
        isLoadingMore={isLoadingMore}
      />
      <EmojiPickerWrapper
        isEmojiBoxOpen={isEmojiBoxOpen}
        emojiPickerPosition={emojiPickerPosition}
        closeEmojiPicker={closeEmojiPicker}
        handleEmojiSelect={handleEmojiSelect}
        ref={emojiPickerRef}
      />
      <ChannelActionBar />
      <ScrollToBottomButton messagesContainer={messageContainerRef} />
    </MessageWrapper>
  )
}
