import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { TMessageWithUser } from '@api'
import { MessageContextMenu } from '../../MessageContextMenu'
import MessageReaction from '../../MessageReaction'
import { useUserProfileModalStore } from '../UserProfileModal'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore, useChatStore } from '@stores'
import MessageFooter from './MessageFooter'
import MessageHeader from './MessageHeader'
import MessageContent from './MessageContent'
import { isOnlyEmoji } from '@utils/index'
import { useChannel } from '../../context/ChannelProvider'

type TMessageCardProps = {
  data: TMessageWithUser
  toggleEmojiPicker: any
  selectedEmoji: any
}

function MessageCard({ data, toggleEmojiPicker, selectedEmoji }: TMessageCardProps, ref: any) {
  const { settings } = useChannel()
  const user = useAuthStore.use.profile()
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const openModal = useUserProfileModalStore((state) => state.openModal)
  const modalOpen = useUserProfileModalStore((state) => state.modalOpen)
  const closeModal = useUserProfileModalStore((state) => state.closeModal)
  const cardRef = useRef<any>(null)

  useEffect(() => {
    if (ref) {
      ref.current = cardRef.current
    }
    // Attach the data.id to the cardRef directly
    if (cardRef.current) {
      cardRef.current.msgId = data.id
      cardRef.current.readedAt = data.readed_at
      cardRef.current.createdAt = data.created_at
    }
  }, [ref, data])

  const handleAvatarClick = () => {
    // Assuming data contains user information
    if (modalOpen) closeModal()
    else {
      openModal('userProfileModal', data.user_details)
    }
  }

  const handleDoubleClick = useCallback(() => {
    if (!settings.contextMenue?.reply) return
    setReplayMessageMemory(data.channel_id, data)
    // Triggering editor focus if needed
    const event = new CustomEvent('editor:focus')
    document.dispatchEvent(event)
  }, [data])

  const isGroupEnd = useMemo(() => {
    return data.isGroupEnd
  }, [data.isGroupEnd])

  return (
    <div
      className={`group/msgcard ${
        data?.user_details?.id === user?.id ? 'owner chat-end ml-auto' : 'chat-start mr-auto'
      } msg_card chat relative  w-fit min-w-[80%] max-w-[90%] sm:min-w-[200px] ${isGroupEnd ? 'chat_group-end !mb-2' : 'chat_group-start'}`}
      ref={cardRef}
      onDoubleClick={handleDoubleClick}>
      <Avatar
        src={data?.user_details?.avatar_url}
        className="avatar chat-image w-10 cursor-pointer rounded-full transition-all hover:scale-105"
        style={{
          width: 40,
          height: 40,
          cursour: 'pointer',
          visibility: isGroupEnd ? 'visible' : 'hidden'
        }}
        id={data?.user_details?.id}
        alt={`avatar_${data?.user_details?.id}`}
        onClick={handleAvatarClick}
      />

      {isOnlyEmoji(data?.content) ? (
        <div className="mb-4 min-w-full max-w-[70%]">
          <MessageHeader data={data} />
          <MessageContent data={data} />
          <MessageFooter data={data} />
        </div>
      ) : (
        <div
          className={`chat-bubble !mt-0 flex w-full flex-col ${
            isGroupEnd ? 'bubble_group-end' : 'bubble_group-start !rounded-ee-xl !rounded-es-xl'
          }`}>
          <MessageHeader data={data} />
          <MessageContent data={data} />
          <MessageFooter data={data} />
        </div>
      )}

      <MessageReaction
        message={data}
        selectedEmoji={selectedEmoji}
        toggleEmojiPicker={toggleEmojiPicker}
      />

      <MessageContextMenu
        parrentRef={cardRef}
        messageData={data}
        className="menu z-20 m-0 w-48 rounded-lg bg-base-100 p-2 shadow outline-none"
      />
    </div>
  )
}

export default React.forwardRef(MessageCard)
