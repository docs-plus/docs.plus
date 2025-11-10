import React from 'react'
import { useChatStore, useSheetStore } from '@stores'
import { CHAT_OPEN } from '@services/eventsHub'
import { Picker } from './Picker'
import { createPortal } from 'react-dom'
import { useCloseOnResize } from '@hooks/useCloseOnResize'
import { useEmojiPanelContext } from './context/EmojiPanelContext'
import { emojiReaction } from '@api'

export const EmojiSelector = () => {
  const { variant } = useEmojiPanelContext()
  const { sheetData } = useSheetStore()
  const { emojiPicker, closeEmojiPicker } = useChatStore()
  const { editorInstance } = useChatStore((state) => state.chatRoom)

  // TODO: this is only work for mobile
  const emojiSelectHandler = (emoji: any) => {
    if (variant === 'mobile' && emojiPicker.eventType !== 'react2Message') {
      const { headingId } = sheetData.chatRoomState

      PubSub.publish(CHAT_OPEN, {
        headingId: headingId,
        insertContent: emoji.native,
        clearSheetState: true
      })
    } else if (emojiPicker.eventType === 'react2Message' && variant === 'mobile') {
      emojiReaction(emojiPicker.selectedMessage, emoji.native)
      // close the emoji picker
      closeEmojiPicker()
      return
    } else if (emojiPicker.eventType === 'react2Message') {
      emojiReaction(emojiPicker.selectedMessage, emoji.native)

      // close the emoji picker
      closeEmojiPicker()
    } else {
      editorInstance?.commands.insertContent(emoji.native)
      closeEmojiPicker()
    }
  }

  useCloseOnResize()

  if (variant === 'desktop') {
    return createPortal(
      <div
        className=""
        style={{
          position: 'fixed',
          top: `${emojiPicker.position?.top || 0}px`,
          left: `${emojiPicker.position?.left || 0}px`,
          visibility: emojiPicker.isOpen ? 'visible' : 'hidden',
          zIndex: 999
        }}>
        <Picker emojiSelectHandler={emojiSelectHandler} />
      </div>,
      document.body
    )
  }

  return <Picker emojiSelectHandler={emojiSelectHandler} />
}
