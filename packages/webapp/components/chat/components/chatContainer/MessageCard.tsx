/* eslint-disable no-use-before-define */
// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { TMessageWithUser } from '@api'
import { MessageContextMenu } from '../../MessageContextMenu'
import MessageReaction from '../../MessageReaction'
import { useUserProfileModalStore } from '../UserProfileModal'
import { Avatar } from '../ui/Avatar'
import { useAuthStore, useChatStore } from '@stores'
import MessageFooter from './MessageFooter'
import MessageHeader from './MessageHeader'
import MessageContent from './MessageContent'
import { isOnlyEmoji } from '@utils/emojis'

type TMessageCardProps = {
  data: TMessageWithUser
  toggleEmojiPicker: any
  selectedEmoji: any
}

function MessageCard({ data, toggleEmojiPicker, selectedEmoji }: TMessageCardProps, ref: any) {
  const user = useAuthStore.use.profile()
  const openModal = useUserProfileModalStore((state) => state.openModal)
  const modalOpen = useUserProfileModalStore((state) => state.modalOpen)
  const closeModal = useUserProfileModalStore((state) => state.closeModal)
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const cardRef = useRef(null)

  useEffect(() => {
    if (ref) ref.current = cardRef.current
  }, [ref])

  const handleAvatarClick = () => {
    // Assuming data contains user information
    if (modalOpen) closeModal()
    else {
      openModal('userProfileModal', data.user_details)
    }
  }

  const handleDoubleClick = useCallback(() => {
    setReplayMessageMemory(data)
    // Triggering editor focus if needed
    const event = new CustomEvent('editor:focus')
    document.dispatchEvent(event)
  }, [data])

  const isGroupEnd = useMemo(() => {
    return data.isGroupEnd
  }, [data.isGroupEnd])

  const isGroupStart = useMemo(() => {
    return data.isGroupStart
  }, [data.isGroupStart])

  const isNewGroupById = useMemo(() => {
    return data.isNewGroupById
  }, [data.isNewGroupById])

  return (
    <div
      className={`group ${
        data?.user_details?.id === user?.id ? 'msg_card chat-end ml-auto' : 'chat-start  mr-auto'
      } chat relative w-auto min-w-[30%] max-w-[70%] ${isGroupEnd ? 'chat_group-end !mb-2' : 'chat_group-start '}`}
      ref={cardRef}
      onDoubleClick={handleDoubleClick}>
      <Avatar
        src={data?.user_details?.avatar_url}
        className="w-10 rounded-full chat-image avatar"
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
        <div className="max-w-[70%] min-w-full mb-4">
          <MessageHeader data={data} />
          <MessageContent data={data} />
          <MessageFooter data={data} />
        </div>
      ) : (
        <div
          className={`chat-bubble !mt-0 flex flex-col w-full ${
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
        className="m-0 z-20 menu p-2 outline-none shadow bg-base-100 rounded-lg w-40"
      />
    </div>
  )
}

export default React.forwardRef(MessageCard)
