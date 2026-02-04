import { markNotificationAsRead } from '@api'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useState } from 'react'

import {
  getPermissionStatus,
  isPushSupported,
  isSubscribed as checkSubscribed,
  onPermissionChange,
  PushError,
  refreshSubscriptionIfNeeded,
  registerPushSubscription,
  unregisterPushSubscription
} from '../lib/push-notifications'

export type SubscribeResult = 'success' | 'denied' | 'dismissed' | 'error'
export type { PushErrorCode } from '../lib/push-notifications'

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
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isRecoverable, setIsRecoverable] = useState(false)

  // Check subscription status and refresh if needed on mount
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

        // If subscribed, check if refresh is needed
        if (subscribed) {
          const refreshResult = await refreshSubscriptionIfNeeded()
          if (refreshResult === 'refreshed') {
            // Subscription was refreshed successfully
          } else if (refreshResult === 'failed') {
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

  // Listen for permission changes (user revokes in browser settings)
  useEffect(() => {
    if (!isSupported) return

    const unsubscribe = onPermissionChange((newPermission) => {
      setPermission(newPermission)

      // If permission was revoked, update subscribed state
      if (newPermission === 'denied') {
        setIsSubscribed(false)
        setError('Notifications permission was revoked')
        setErrorCode('PERMISSION_DENIED')
        setIsRecoverable(false)
      }
    })

    return unsubscribe
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

      // Shouldn't reach here with new error handling, but handle gracefully
      setError('Failed to subscribe')
      setErrorCode('UNKNOWN')
      return 'error'
    } catch (err) {
      // Handle typed PushError
      if (err instanceof PushError) {
        setError(err.message)
        setErrorCode(err.code)
        setIsRecoverable(err.recoverable)

        // Update permission state
        const currentPermission = Notification.permission
        setPermission(currentPermission)

        // Map error codes to result types
        switch (err.code) {
          case 'PERMISSION_DENIED':
            return 'denied'
          case 'PERMISSION_DISMISSED':
            return 'dismissed'
          default:
            return 'error'
        }
      }

      // Handle unknown errors
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

  // Manual refresh subscription (e.g., from settings page)
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
