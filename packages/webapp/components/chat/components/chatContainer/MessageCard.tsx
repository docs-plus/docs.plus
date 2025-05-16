import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { TMessageWithUser } from '@api'
import { MessageContextMenu } from '../../MessageContextMenu'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore, useChatStore, useStore } from '@stores'
import MessageFooter from './MessageFooter'
import MessageHeader from './MessageHeader'
import MessageContent from './MessageContent'
import { isOnlyEmoji } from '@utils/index'
import { useChannel } from '../../context/ChannelProvider'
import { MsgComment } from './MsgComment'
import { MsgReplyTo } from './MsgReplyTo'

type TMessageCardProps = {
  data: TMessageWithUser
  toggleEmojiPicker: any
  selectedEmoji: any
}

// Define the extended HTMLDivElement interface with our custom properties
interface MessageCardElement extends HTMLDivElement {
  msgId?: string
  readedAt?: string | null
  createdAt?: string | null
}

function MessageCard({ data, toggleEmojiPicker, selectedEmoji }: TMessageCardProps, ref: any) {
  const { settings } = useChannel()
  const user = useAuthStore.use.profile()
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const cardRef = useRef<MessageCardElement>(null)

  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const isGroupEnd = data.isGroupEnd
  const isOwnerMessage = data?.user_details?.id === user?.id
  const isEmojiOnlyMessage = isOnlyEmoji(data?.content)

  // Attach ref and message data to DOM element
  useEffect(() => {
    if (ref) {
      ref.current = cardRef.current
    }

    if (cardRef.current) {
      cardRef.current.msgId = data.id
      cardRef.current.readedAt = data.readed_at
      cardRef.current.createdAt = data.created_at
    }
  }, [ref, data])

  const handleDoubleClick = useCallback(() => {
    if (!settings.contextMenue?.reply) return

    setReplyMessageMemory(data.channel_id, data)

    // Trigger editor focus
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [data, settings.contextMenue?.reply, setReplyMessageMemory])

  const renderAvatar = () => {
    // On desktop, always show avatar; on mobile, only show for non-owner messages
    if (isMobile && isOwnerMessage) return null

    return (
      <div className="avatar chat-image">
        <Avatar
          src={data?.user_details?.avatar_url}
          avatarUpdatedAt={data?.user_details?.avatar_updated_at}
          className="avatar chat-image w-10 cursor-pointer rounded-full transition-all hover:scale-105"
          style={{
            width: 40,
            height: 40,
            cursour: 'pointer',
            visibility: isGroupEnd ? 'visible' : 'hidden'
          }}
          id={data?.user_details?.id}
          alt={`avatar_${data?.user_details?.id}`}
        />
      </div>
    )
  }

  const renderMessageContent = () => {
    if (isEmojiOnlyMessage) {
      return (
        <div className="mb-4 max-w-[70%] min-w-full">
          {data.reply_to_message_id && <MsgReplyTo data={data} />}
          <MessageContent message={data} />
          <MessageFooter data={data} />
        </div>
      )
    }

    return (
      <div
        className={`chat-bubble !mt-0 flex w-full flex-col p-2 ${
          isOwnerMessage ? 'bg-chatBubble-owner' : 'bg-white drop-shadow'
        } ${isGroupEnd ? 'bubble_group-end' : 'bubble_group-start !rounded-ee-xl !rounded-es-xl'}`}>
        {data.metadata?.comment && <MsgComment data={data} />}
        {data.reply_to_message_id && <MsgReplyTo data={data} />}
        <MessageContent message={data} />
        <MessageFooter data={data} />
      </div>
    )
  }

  return (
    <div
      className={`group/msgcard chat my-0.5 ${
        isOwnerMessage && isMobile ? 'owner chat-end ml-auto' : 'chat-start mr-auto'
      } msg_card relative w-fit max-w-[90%] min-w-[80%] sm:min-w-[250px] ${
        isGroupEnd ? 'chat_group-end !mb-2' : 'chat_group-start'
      }`}
      ref={cardRef}
      onDoubleClick={handleDoubleClick}>
      {renderAvatar()}
      <MessageHeader data={data} ownerMsg={isOwnerMessage} />
      {renderMessageContent()}
      <MessageContextMenu
        parrentRef={cardRef}
        messageData={data}
        className="menu bg-base-100 z-20 m-0 w-48 rounded-lg p-2 shadow outline-none"
      />
    </div>
  )
}

export default React.forwardRef(MessageCard)
