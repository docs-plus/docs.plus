import { markAllNotificationsAsRead } from '@api'
import { useAuthStore, useStore } from '@stores'

export const useMarkAllNotificationsAsRead = () => {
  const {
    setNotificationActiveTab,
    emptyNotifications,
    setLoadingNotification,
    setNotificationTab
  } = useStore((state) => state)
  const user = useAuthStore((state) => state.profile)

  const handleMarkAllAsRead = async () => {
    if (!user) return
    setLoadingNotification(true)
    try {
      const { data: _data, error } = await markAllNotificationsAsRead(user.id)
      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }

      // Clear all notifications from the state (this clears all tabs)
      emptyNotifications()

      // Reset unread counts to 0
      setNotificationTab('Unread', 0)
      setNotificationTab('Mentions', 0)

      // Switch to Read tab to show the newly read notifications
      setNotificationActiveTab('Read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    } finally {
      setLoadingNotification(false)
    }
  }

  return { handleMarkAllAsRead }
}
