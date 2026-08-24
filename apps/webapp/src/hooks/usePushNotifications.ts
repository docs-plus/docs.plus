import { markNotificationAsRead } from '@api'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import {
  getPermissionStatus,
  isPushSupported,
  isSubscribed as checkSubscribed,
  onPermissionChange,
  PushError,
  refreshSubscriptionIfNeeded,
  registerPushSubscription,
  unregisterPushSubscription
} from '@utils/push-notifications'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useState } from 'react'

export type SubscribeResult = 'success' | 'denied' | 'dismissed' | 'error'
export type { PushErrorCode } from '@utils/push-notifications'

// Event for notification state changes (used by notification panel to refresh)
export const NOTIFICATION_STATE_CHANGED = Symbol('notification.stateChanged')

interface UsePushNotificationsReturn {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  errorCode: string | null
  isRecoverable: boolean
  subscribe: () => Promise<SubscribeResult>
  unsubscribe: () => Promise<boolean>
  refreshSubscription: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = useState(() => isPushSupported())
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getPermissionStatus()
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isRecoverable, setIsRecoverable] = useState(false)

  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false)
      return
    }

    const timeoutId = setTimeout(() => setIsLoading(false), 3000)

    const initSubscription = async () => {
      try {
        const subscribed = await checkSubscribed()
        setIsSubscribed(subscribed)

        if (subscribed) {
          const refreshResult = await refreshSubscriptionIfNeeded()
          if (refreshResult === 'failed') {
            // Refresh failed, but don't show error to user - subscription might still work
          }
        }
      } catch {
        // Ignore errors during init
      } finally {
        clearTimeout(timeoutId)
        setIsLoading(false)
      }
    }

    initSubscription()
  }, [isSupported])

  // Fires when the user revokes permission in browser settings.
  useEffect(() => {
    if (!isSupported) return

    const unsubscribe = onPermissionChange((newPermission) => {
      setPermission(newPermission)

      if (newPermission === 'denied') {
        setIsSubscribed(false)
        setError('Notifications permission was revoked')
        setErrorCode('PERMISSION_DENIED')
        setIsRecoverable(false)
      }
    })

    return unsubscribe
  }, [isSupported])

  useEffect(() => {
    if (!isSupported) return

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url, notification_id } = event.data

        if (notification_id) {
          try {
            await markNotificationAsRead(notification_id)

            const store = useStore.getState()
            const { notifications, updateNotifications, setNotificationTab, notificationTabs } =
              store

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
            PubSub.publish(NOTIFICATION_STATE_CHANGED, { notification_id })
          } catch (err) {
            console.error('Failed to mark notification as read:', err)
          }
        }

        if (url) {
          const urlObj = new URL(url, window.location.origin)
          const channelId = urlObj.searchParams.get('chatroom')
          const messageId = urlObj.searchParams.get('msg_id')

          if (channelId) {
            // PubSub keeps navigation in-app, same as NotificationItem.
            PubSub.publish(CHAT_OPEN, {
              headingId: channelId,
              toggleRoom: false,
              fetchMsgsFromId: messageId || undefined,
              scroll2Heading: true
            })
          } else {
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
      setErrorCode('NOT_SUPPORTED')
      setIsRecoverable(false)
      return 'error'
    }

    setIsLoading(true)
    setError(null)
    setErrorCode(null)
    setIsRecoverable(false)

    try {
      const subscriptionId = await registerPushSubscription()
      if (subscriptionId) {
        setIsSubscribed(true)
        setPermission('granted')
        return 'success'
      }

      // Unreachable in practice: registerPushSubscription throws instead of returning null.
      setError('Failed to subscribe')
      setErrorCode('UNKNOWN')
      return 'error'
    } catch (err) {
      if (err instanceof PushError) {
        setError(err.message)
        setErrorCode(err.code)
        setIsRecoverable(err.recoverable)

        const currentPermission = Notification.permission
        setPermission(currentPermission)

        switch (err.code) {
          case 'PERMISSION_DENIED':
            return 'denied'
          case 'PERMISSION_DISMISSED':
            return 'dismissed'
          default:
            return 'error'
        }
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setErrorCode('UNKNOWN')
      setIsRecoverable(true) // Unknown errors might be transient

      return 'error'
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    setIsLoading(true)
    setError(null)
    setErrorCode(null)
    setIsRecoverable(false)

    try {
      const success = await unregisterPushSubscription()
      if (success) {
        setIsSubscribed(false)
        return true
      }
      setError('Failed to unsubscribe')
      setErrorCode('UNKNOWN')
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setErrorCode('UNKNOWN')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const refreshSubscription = useCallback(async (): Promise<void> => {
    if (!isSupported || !isSubscribed) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await refreshSubscriptionIfNeeded()
      if (result === 'failed') {
        setError('Failed to refresh subscription')
        setErrorCode('SUBSCRIPTION_FAILED')
        setIsRecoverable(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setErrorCode('UNKNOWN')
      setIsRecoverable(true)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, isSubscribed])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    errorCode,
    isRecoverable,
    subscribe,
    unsubscribe,
    refreshSubscription
  }
}

export default usePushNotifications
