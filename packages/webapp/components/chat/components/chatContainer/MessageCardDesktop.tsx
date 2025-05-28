import React, { useCallback, useEffect, useRef } from 'react'
import { TMessageWithUser as TMsg } from '@api'
import { MessageContextMenu } from '../../MessageContextMenu'
import { useChatStore } from '@stores'
import { isOnlyEmoji } from '@utils/index'
import { useChannel } from '../../context/ChannelProvider'
import { MdOutlineBookmark } from 'react-icons/md'

// Component imports
import MessageContent from './MessageContent'
import { MsgComment } from './MsgComment'
import { MsgReplyTo } from './MsgReplyTo'
import ReactionsCard from './ReactionsCard'
import { MessageActions } from './message-parts/MessageActions'
import { MessageHeader } from './message-parts/MessageHeader'
import { ProfilePic } from './message-parts/ProfilePic'
import { MessageIndicators } from './message-parts/MessageIndicators'

// Types
export type TMessageCardDesktopProps = {
  message: TMsg
  toggleEmojiPicker: any
  selectedEmoji: any
}

// Define the extended HTMLDivElement interface with our custom properties
export interface MessageCardDesktopElement extends HTMLDivElement {
  msgId?: string
  readedAt?: string | null
  createdAt?: string | null
}

function MessageCardDesktop({ message }: TMessageCardDesktopProps, ref: any) {
  const { settings } = useChannel()
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const cardRef = useRef<MessageCardDesktopElement>(null)

  const isEmojiOnlyMessage = isOnlyEmoji(message?.content?.trim() || '')
  const isGroupStart = message.isGroupStart

  // Attach ref and message data to DOM element
  useEffect(() => {
    if (ref) {
      ref.current = cardRef.current
    }

    if (cardRef.current) {
      cardRef.current.msgId = message.id
      cardRef.current.readedAt = message.readed_at
      cardRef.current.createdAt = message.created_at
    }
  }, [ref, message])

  const handleDoubleClick = useCallback(() => {
    if (!settings.contextMenue?.reply) return

    setReplyMessageMemory(message.channel_id, message)

    // Trigger editor focus
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [message, settings.contextMenue?.reply, setReplyMessageMemory])

  const renderMessageContent = () => {
    if (isEmojiOnlyMessage) {
      return (
        <div className="flex flex-row items-center">
          <div className="relative ml-3 flex flex-col items-center space-y-2">
            <time className="invisible relative text-xs whitespace-nowrap opacity-50 group-hover/msgcard:visible">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </time>
          </div>
          <div className="w-full pl-2">
            {message.reply_to_message_id && <MsgReplyTo message={message} />}
            <MessageContent message={message} />
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-row items-center">
        <div className="relative ml-3 flex flex-col items-center space-y-2">
          <time className="invisible relative text-xs whitespace-nowrap opacity-50 group-hover/msgcard:visible">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </time>
        </div>
        <div className={`!mt-0 flex w-full flex-col pl-2 text-[15px] font-normal antialiased`}>
          {message.metadata?.comment && <MsgComment message={message} />}
          {message.reply_to_message_id && <MsgReplyTo message={message} />}
          <MessageContent message={message} />
          <MessageIndicators message={message} />
          <ReactionsCard reactions={message.reactions} message={message} showReactionBtn={false} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group/msgcard chat msg_card ${
        message.is_bookmarked || message.bookmark_id
          ? 'my-1 bg-blue-50 hover:bg-blue-100'
          : 'hover:bg-base-200'
      } relative w-full rounded-md pl-3 transition-colors`}
      ref={cardRef}
      onDoubleClick={handleDoubleClick}>
      {(message.is_bookmarked || message.bookmark_id) && (
        <div className={`flex items-center gap-1 pt-1 pb-4 text-xs font-medium text-blue-600`}>
          <MdOutlineBookmark size={16} />
          <span>Saved for later</span>
        </div>
      )}

      <MessageActions
        className="absolute -top-4 right-2 hidden group-hover/msgcard:block"
        message={message}
      />
      <div className="flex w-full items-start gap-2">
        <div className="relative flex flex-col items-center space-y-2">
          <ProfilePic message={message} />
        </div>

        {isGroupStart && (
          <div className="flex w-full flex-col">
            <MessageHeader message={message} />

            <div className={`!mt-0 flex w-full flex-col text-[15px] font-normal antialiased`}>
              {message.metadata?.comment && <MsgComment message={message} />}
              {message.reply_to_message_id && <MsgReplyTo message={message} />}
              <MessageContent message={message} />
              <MessageIndicators message={message} />
              <ReactionsCard
                reactions={message.reactions}
                message={message}
                showReactionBtn={false}
              />
            </div>
          </div>
        )}
      </div>
      {!isGroupStart && renderMessageContent()}
      <MessageContextMenu
        parrentRef={cardRef}
        messageData={message}
        className="menu bg-base-100 z-20 m-0 w-48 rounded-lg p-2 shadow outline-none"
      />
    </div>
  )
}

export default React.forwardRef(MessageCardDesktop)
