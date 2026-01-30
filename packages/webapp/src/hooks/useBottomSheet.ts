import { useSheetStore } from '@stores'

/**
 * Hook for opening bottom sheets with a simple API
 */
export const useBottomSheet = () => {
  const { openSheet } = useSheetStore()

  return {
    openChatRoom: (headingId: string) => openSheet('chatroom', { headingId }),
    openNotifications: () => openSheet('notifications'),
    openFilters: () => openSheet('filters')
  }
}
