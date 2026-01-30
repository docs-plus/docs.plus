import { markNotificationAsRead } from '@api'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback,useEffect, useState } from 'react'

import {
  getPermissionStatus,
  isPushSupported,
  isSubscribed as checkSubscribed,
  registerPushSubscription,
  unregisterPushSubscription} from '../lib/push-notifications'

export type SubscribeResult = 'success' | 'denied' | 'dismissed' | 'error'

// Event for notification state changes (used by notification panel to refresh)
export const NOTIFICATION_STATE_CHANGED = Symbol('notification.stateChanged')

interface UsePushNotificationsReturn {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  subscribe: () => Promise<SubscribeResult>
  unsubscribe: () => Promise<boolean>
}

/**
 * Hook for managing push notifications
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = useState(() => isPushSupported())
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getPermissionStatus()
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check subscription status on mount
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false)
      return
    }

    checkSubscribed()
      .then(setIsSubscribed)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isSupported])

  // Listen for notification clicks from service worker
  useEffect(() => {
    if (!isSupported) return

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url, notification_id } = event.data

        // 1. Mark notification as read in database
        if (notification_id) {
          try {
            await markNotificationAsRead(notification_id)

            // 2. Update notification store - remove from unread lists and decrement counts
            const store = useStore.getState()
            const { notifications, updateNotifications, setNotificationTab, notificationTabs } =
              store

            // Remove notification from all tabs
            ;(['Unread', 'Mentions'] as const).forEach((tab) => {
              const tabNotifications = notifications.get(tab)
              if (tabNotifications) {
                const filtered = tabNotifications.filter((n) => n.id !== notification_id)
                if (filtered.length !== tabNotifications.length) {
                  updateNotifications(tab, filtered)
                  // Update tab count
                  const tabInfo = notificationTabs.find((t) => t.label === tab)
                  if (tabInfo?.count) {
                    setNotificationTab(tab, Math.max(0, tabInfo.count - 1))
                  }
                }
              }
            })

            // 3. Publish event for any listeners (e.g., notification summary refresh)
            PubSub.publish(NOTIFICATION_STATE_CHANGED, { notification_id })
          } catch (err) {
            console.error('Failed to mark notification as read:', err)
          }
        }

        // 4. Navigate to the message using PubSub for seamless in-app navigation
        if (url) {
          const urlObj = new URL(url, window.location.origin)
          const channelId = urlObj.searchParams.get('chatroom')
          const messageId = urlObj.searchParams.get('msg_id')

          if (channelId) {
            // Use PubSub for smooth in-app navigation (same as NotificationItem)
            PubSub.publish(CHAT_OPEN, {
              headingId: channelId,
              toggleRoom: false,
              fetchMsgsFromId: messageId || undefined,
              scroll2Heading: true
            })
          } else {
            // Fallback to URL navigation for non-chat notifications
            const currentUrl = window.location.pathname + window.location.search
            if (url !== currentUrl) {
              window.location.href = url
            }
          }
        }
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage)
  }, [isSupported])

  const subscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (!isSupported) {
      setError('Push notifications not supported')
      return 'error'
    }

    setIsLoading(true)
    setError(null)

    try {
      const subscriptionId = await registerPushSubscription()
      if (subscriptionId) {
        setIsSubscribed(true)
        setPermission('granted')
        return 'success'
      }

      // Subscription returned null (shouldn't happen now with throws, but handle gracefully)
      const currentPermission = Notification.permission
      setPermission(currentPermission)

      if (currentPermission === 'denied') {
        setError('Notifications blocked by browser')
        return 'denied'
      }

      // User dismissed the browser permission prompt
      if (currentPermission === 'default') {
        return 'dismissed'
      }

      setError('Failed to subscribe')
      return 'error'
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      // Check if it's a configuration error (server-side issue)
      if (errorMessage.includes('not configured')) {
        setError(errorMessage)
        return 'error'
      }

      // Check browser permission state
      const currentPermission = Notification.permission
      setPermission(currentPermission)

      if (currentPermission === 'denied') {
        setError('Notifications blocked by browser')
        return 'denied'
      }

      setError(errorMessage)
      return 'error'
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    setIsLoading(true)
    setError(null)

    try {
      const success = await unregisterPushSubscription()
      if (success) {
        setIsSubscribed(false)
        return true
      }
      setError('Failed to unsubscribe')
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe
  }
}

export default usePushNotifications
