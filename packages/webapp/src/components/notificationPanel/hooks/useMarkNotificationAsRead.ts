import { markNotificationAsRead } from '@api'
import { useStore } from '@stores'

export const useMarkNotificationAsRead = () => {
  const updateNotifications = useStore((state) => state.updateNotifications)
  const setLoadingNotification = useStore((state) => state.setLoadingNotification)
  const notificationActiveTab = useStore((state) => state.notificationActiveTab)
  const notifications = useStore((state) => state.notifications)

  const handleMarkAsRead = async (e: any, notificationId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent?.stopImmediatePropagation?.()
    setLoadingNotification(true)

    try {
      await markNotificationAsRead(notificationId)
      const activeTabNotifications = notifications.get(notificationActiveTab)
      if (!activeTabNotifications) return
      const filteredNotifications = activeTabNotifications.filter(
        (notif) => notif.id !== notificationId
      )

      updateNotifications(notificationActiveTab, filteredNotifications)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    } finally {
      setTimeout(() => {
        setLoadingNotification(false)
      }, 2000)
    }
  }

  return { handleMarkAsRead }
}
