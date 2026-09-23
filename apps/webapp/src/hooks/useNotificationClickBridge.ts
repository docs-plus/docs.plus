import { markNotificationAsRead } from '@api'
import { trackClientRead } from '@components/notificationPanel/feed/readDedupe'
import { CHAT_OPEN, NOTIFICATION_STATE_CHANGED } from '@services/eventsHub'
import { useStore } from '@stores'
import { padSlugOf } from '@utils/filterRoute'
import { isPushSupported } from '@utils/push-notifications'
import PubSub from 'pubsub-js'
import { useEffect } from 'react'

const handleNotificationClick = async (event: MessageEvent) => {
  if (event.data?.type !== 'NOTIFICATION_CLICK') return
  const { url, notification_id } = event.data

  if (notification_id) {
    try {
      // Before the write, so its realtime UPDATE cannot lower the count a second time.
      trackClientRead(notification_id)
      await markNotificationAsRead(notification_id)

      const store = useStore.getState()
      const { notifications, updateNotifications, setNotificationTab, notificationTabs } = store

      ;(['Unread', 'Mentions'] as const).forEach((tab) => {
        const tabNotifications = notifications.get(tab)
        if (tabNotifications) {
          const filtered = tabNotifications.filter((n) => n.id !== notification_id)
          if (filtered.length !== tabNotifications.length) {
            updateNotifications(tab, filtered)
            const tabInfo = notificationTabs.find((t) => t.label === tab)
            if (tabInfo?.count) {
              setNotificationTab(tab, Math.max(0, tabInfo.count - 1))
            }
          }
        }
      })

      // Listeners include the notification summary refresh.
      PubSub.publish(NOTIFICATION_STATE_CHANGED)
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  if (url) {
    const urlObj = new URL(url, window.location.origin)
    const channelId = urlObj.searchParams.get('chatroom')
    const messageId = urlObj.searchParams.get('msg_id')

    if (channelId && padSlugOf(urlObj.pathname) === padSlugOf(window.location.pathname)) {
      // PubSub keeps navigation in-app, same as NotificationItem.
      PubSub.publish(CHAT_OPEN, {
        headingId: channelId,
        toggleRoom: false,
        fetchMsgsFromId: messageId || undefined,
        scroll2Heading: true
      })
    } else {
      // Another pad's chatroom id would open on this pad, so load its page.
      // The path only, so an absolute action_url stays on this origin.
      const target = urlObj.pathname + urlObj.search + urlObj.hash
      const { pathname, search, hash } = window.location
      if (target !== pathname + search + hash) {
        window.location.assign(target)
      }
    }
  }
}

/** Handles a push click the service worker relays to an open window. Mount once, app-wide. */
export function useNotificationClickBridge() {
  useEffect(() => {
    if (!isPushSupported()) return
    navigator.serviceWorker.addEventListener('message', handleNotificationClick)
    return () => navigator.serviceWorker.removeEventListener('message', handleNotificationClick)
  }, [])
}
