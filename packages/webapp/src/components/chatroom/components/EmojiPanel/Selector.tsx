import { emojiReaction } from '@api'
import { useCloseOnResize } from '@hooks/useCloseOnResize'
import type { SheetDataMap } from '@stores'
import { useChatStore, useSheetStore } from '@stores'
import { retryWithBackoff } from '@utils/retryWithBackoff'
import { createPortal } from 'react-dom'

import { useEmojiPanelContext } from './context/EmojiPanelContext'
import { Picker } from './Picker'

/**
 * EmojiSelector
 * -------------
 * Renders the emoji Picker and handles emoji-select for both desktop
 * and mobile variants.
 *
 * Desktop: portal-positioned picker near the caret.
 * Mobile:  rendered inline inside the BottomSheet's emojiPicker content area.
 */
export const EmojiSelector = () => {
  const { variant } = useEmojiPanelContext()
  const { sheetData } = useSheetStore()
  const { emojiPicker, closeEmojiPicker } = useChatStore()
  const { editorInstance } = useChatStore((state) => state.chatRoom)

  const emojiSelectHandler = (emoji: any) => {
    const nativeEmoji: string = emoji.native

    // ------------------------------------------------------------------
    // Mobile: emoji selected from the composer's emoji picker sheet
    // ------------------------------------------------------------------
    if (variant === 'mobile' && emojiPicker.eventType !== 'react2Message') {
      const emojiData = sheetData as SheetDataMap['emojiPicker']
      const headingId = emojiData?.chatRoomState?.headingId

      if (!headingId) return

      // Switch back to the chatroom sheet and insert the emoji once the
      // editor is mounted and the sheet animation has finished.
      useSheetStore.getState().switchSheet('chatroom', { headingId })

      retryWithBackoff(
        () => {
          const { editorInstance } = useChatStore.getState().chatRoom
          const { sheetState, isSheetOpen } = useSheetStore.getState()

          if (sheetState === 'open' && editorInstance && isSheetOpen('chatroom')) {
            editorInstance.chain().focus().insertContent(nativeEmoji).run()
            return true
          }
          return false
        },
        { maxAttempts: 6, initialDelayMs: 400, maxDelayMs: 1000 }
      )
      return
    }

    // ------------------------------------------------------------------
    // React-to-message: add reaction (both mobile & desktop)
    // ------------------------------------------------------------------
    if (emojiPicker.eventType === 'react2Message') {
      emojiReaction(emojiPicker.selectedMessage, nativeEmoji)
      closeEmojiPicker()
      return
    }

    // ------------------------------------------------------------------
    // Desktop: insert emoji at caret in the composer editor
    // ------------------------------------------------------------------
    editorInstance?.commands.insertContent(nativeEmoji)
    closeEmojiPicker()
  }

  useCloseOnResize()

  if (variant === 'desktop') {
    return createPortal(
      <div
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
