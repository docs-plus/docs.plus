import { markNotificationAsRead } from '@api'
import { trackClientRead } from '@components/notificationPanel/feed/readDedupe'
import { useFeedItemExit } from '@hooks/useFeedItemExit'
import { useStore } from '@stores'
import { TNotification } from '@types'
import { useCallback } from 'react'

export function useMarkNotificationAsRead() {
  const decrementNotificationCounts = useStore((state) => state.decrementNotificationCounts)
  const removeNotificationById = useStore((state) => state.removeNotificationById)
  const { isExiting: isDismissing, runWithExit } = useFeedItemExit<string>()

  const markAsRead = useCallback(
    async (notification: TNotification) => {
      const { id } = notification

      if (
        !runWithExit(
          id,
          () => removeNotificationById(id),
          () => {
            trackClientRead(id)
            decrementNotificationCounts(notification)
          }
        )
      ) {
        return
      }

      try {
        await markNotificationAsRead(id)
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    },
    [decrementNotificationCounts, removeNotificationById, runWithExit]
  )

  return { markAsRead, isDismissing }
}
