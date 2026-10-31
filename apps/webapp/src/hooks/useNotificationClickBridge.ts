import { markNotificationAsRead } from '@api'
import { trackClientRead } from '@components/notificationPanel/feed/readDedupe'
import { NOTIFICATION_STATE_CHANGED } from '@services/eventsHub'
import { openChatFromLink } from '@services/openChatFromLink'
import { padUrl } from '@services/padUrl'
import { useAuthStore, useStore } from '@stores'
import { isPushSupported } from '@utils/push-notifications'
import Router, { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { useEffect, useRef } from 'react'

// The service worker sets it when a push click opens a new window (#312).
const NOTIFICATION_ID_PARAM = 'notification_id'

const markPushNotificationRead = async (notificationId: string) => {
  try {
    // Before the write, so its realtime UPDATE cannot lower the count a second time.
    trackClientRead(notificationId)
    await markNotificationAsRead(notificationId)

    const { notifications, updateNotifications, setNotificationTab, notificationTabs } =
      useStore.getState()

    ;(['Unread', 'Mentions'] as const).forEach((tab) => {
      const tabNotifications = notifications.get(tab)
      if (tabNotifications) {
        const filtered = tabNotifications.filter((n) => n.id !== notificationId)
        if (filtered.length !== tabNotifications.length) {
          updateNotifications(tab, filtered)
          const tabInfo = notificationTabs.find((t) => t.label === tab)
          if (tabInfo?.count) {
            setNotificationTab(tab, Math.max(0, tabInfo.count - 1))
          }
        }
      }
    })

    // Listeners include the notification summary refresh and the app icon badge.
    PubSub.publish(NOTIFICATION_STATE_CHANGED)
  } catch (err) {
    console.error('Failed to mark notification as read:', err)
  }
}

const handleNotificationClick = async (event: MessageEvent) => {
  if (event.data?.type !== 'NOTIFICATION_CLICK') return
  const { url, notification_id } = event.data

  if (notification_id) await markPushNotificationRead(notification_id)

  if (url) {
    const pad = padUrl.read(url)
    if (!pad) return

    if (pad.chat && pad.slug === padUrl.read()?.slug) {
      // Stays in-app, same as NotificationItem. The id is resolved against this pad.
      void openChatFromLink(pad.chat.linkId, {
        fetchMsgsFromId: pad.chat.messageId,
        scroll2Heading: true
      })
    } else if (pad.path !== padUrl.read()?.path) {
      // Another pad's chatroom id would open on this pad, so load its page.
      // The path only, so an absolute action_url stays on this origin.
      window.location.assign(pad.path)
    }
  }
}

/**
 * Handles a push click: the service worker relays it to an open window, or opens a new
 * window with the id in the URL. Mount once, app-wide.
 */
export function useNotificationClickBridge() {
  const router = useRouter()
  const sessionUserId = useAuthStore((state) => state.session?.id)
  const authLoading = useAuthStore((state) => state.loading)
  // undefined = URL not read yet; null = nothing left to mark.
  const pendingIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!isPushSupported()) return
    navigator.serviceWorker.addEventListener('message', handleNotificationClick)
    return () => navigator.serviceWorker.removeEventListener('message', handleNotificationClick)
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    if (pendingIdRef.current === undefined) {
      const url = new URL(window.location.href)
      pendingIdRef.current = url.searchParams.get(NOTIFICATION_ID_PARAM)
      if (pendingIdRef.current) {
        // Strip before the session wait, so Share never copies the id.
        url.searchParams.delete(NOTIFICATION_ID_PARAM)
        const path = padUrl.read(url.href)?.path
        if (path) void Router.replace(path, undefined, { shallow: true })
      }
    }
    const notificationId = pendingIdRef.current
    if (!notificationId) return
    if (sessionUserId) {
      pendingIdRef.current = null
      void markPushNotificationRead(notificationId)
    } else if (!authLoading) {
      // Signed out: drop it, so a later sign-in on this page never writes it.
      pendingIdRef.current = null
    }
  }, [router.isReady, sessionUserId, authLoading])
}
