import { markAllNotificationsAsRead } from '@api'
import { useAuthStore, useStore } from '@stores'

export const useMarkAllNotificationsAsRead = () => {
  const { setNotificationActiveTab, emptyNotifications, setLoadingNotification } = useStore(
    (state) => state
  )
  const user = useAuthStore((state) => state.profile)

  const handleMarkAllAsRead = async () => {
    if (!user) return
    setLoadingNotification(true)
    try {
      const { data, error } = await markAllNotificationsAsRead(user.id)
      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }
      // Clear all notifications from the state
      emptyNotifications()
      setNotificationActiveTab('All')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    } finally {
      setLoadingNotification(false)
    }
  }

  return { handleMarkAllAsRead }
}
