import { useAuthStore } from '@stores'
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
import { useCallback, useEffect, useState } from 'react'

export type SubscribeResult = 'success' | 'denied' | 'dismissed' | 'error'
export type { PushErrorCode } from '@utils/push-notifications'

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
  const userId = useAuthStore((s) => s.profile?.id)

  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false)
      return
    }

    const timeoutId = setTimeout(() => setIsLoading(false), 3000)

    const initSubscription = async () => {
      try {
        // Sync first so the toggle shows the repaired state. The RPCs need a session.
        if (userId) await refreshSubscriptionIfNeeded()
        setIsSubscribed(await checkSubscribed())
      } catch {
        // Ignore errors during init
      } finally {
        clearTimeout(timeoutId)
        setIsLoading(false)
      }
    }

    initSubscription()
  }, [isSupported, userId])

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
