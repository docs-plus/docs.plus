import { markAllNotificationsAsRead } from '@api'
import { useAuthStore, useStore } from '@stores'

export const useMarkAllNotificationsAsRead = () => {
  const setNotificationActiveTab = useStore((state) => state.setNotificationActiveTab)
  const emptyNotifications = useStore((state) => state.emptyNotifications)
  const setLoadingNotification = useStore((state) => state.setLoadingNotification)
  const setNotificationTab = useStore((state) => state.setNotificationTab)
  const setTotalNotificationUnreadCount = useStore((state) => state.setTotalNotificationUnreadCount)
  const user = useAuthStore((state) => state.profile)

  const handleMarkAllAsRead = async () => {
    if (!user) return
    setLoadingNotification(true)
    try {
      const { error } = await markAllNotificationsAsRead(user.id)
      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }

      emptyNotifications()

      setNotificationTab('Unread', 0)
      setNotificationTab('Mentions', 0)
      setTotalNotificationUnreadCount(0)

      setNotificationActiveTab('Read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    } finally {
      setLoadingNotification(false)
    }
  }

  return { handleMarkAllAsRead }
}
