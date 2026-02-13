import { useSheetStore } from '@stores'
import { useCallback, useMemo } from 'react'

/**
 * useBottomSheet
 * --------------
 * Thin convenience hook over `useSheetStore` that provides
 * stable, intent-named callbacks for opening / closing sheets.
 *
 * Prefer this hook over calling `useSheetStore` directly in
 * UI components – it keeps coupling low and makes refactors easier.
 */
export const useBottomSheet = () => {
  const { openSheet, closeSheet, switchSheet, activeSheet, sheetState } = useSheetStore()

  const openChatRoom = useCallback(
    (headingId: string) => openSheet('chatroom', { headingId }),
    [openSheet]
  )

  const openNotifications = useCallback(() => openSheet('notifications'), [openSheet])

  const openFilters = useCallback(() => openSheet('filters'), [openSheet])

  const openEmojiPicker = useCallback(
    (chatRoomState?: { headingId: string }) => switchSheet('emojiPicker', { chatRoomState }),
    [switchSheet]
  )

  const close = useCallback(() => closeSheet(), [closeSheet])

  const isOpen = useMemo(() => !!activeSheet, [activeSheet])

  return {
    /** Open the chatroom sheet for a specific heading. */
    openChatRoom,
    /** Open the notifications panel. */
    openNotifications,
    /** Open the filter / search sheet. */
    openFilters,
    /** Switch to the emoji picker (from chatroom context). */
    openEmojiPicker,
    /** Close whatever sheet is currently open. */
    close,
    /** Currently active sheet type (or null). */
    activeSheet,
    /** Animation lifecycle state. */
    sheetState,
    /** Whether any sheet is currently open. */
    isOpen
  }
}
