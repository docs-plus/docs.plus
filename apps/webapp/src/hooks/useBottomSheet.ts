import { useSheetStore } from '@stores'
import { useCallback, useMemo } from 'react'

/**
 * Prefer this over calling `useSheetStore` directly in UI components — it keeps
 * the coupling to the store in one place.
 */
export const useBottomSheet = () => {
  const { openSheet, closeSheet, activeSheet, sheetState } = useSheetStore()

  const openNotifications = useCallback(() => openSheet('notifications'), [openSheet])

  const openFilters = useCallback(() => openSheet('filters'), [openSheet])

  const openBookmarks = useCallback(() => openSheet('bookmarks'), [openSheet])

  const openDocumentSettings = useCallback(() => openSheet('documentSettings'), [openSheet])

  const close = useCallback(() => closeSheet(), [closeSheet])

  const isOpen = useMemo(() => !!activeSheet, [activeSheet])

  return {
    openNotifications,
    openFilters,
    openBookmarks,
    openDocumentSettings,
    close,
    activeSheet,
    sheetState,
    isOpen
  }
}
