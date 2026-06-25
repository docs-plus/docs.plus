import { updateUser } from '@api'
import { useAuthStore } from '@stores'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useRef } from 'react'

const ONLINE = 'ONLINE'
const OFFLINE = 'OFFLINE'
const HEARTBEAT_INTERVAL = 60000 // 60 seconds - keeps online_at fresh for push suppression

export const useHandleUserStatus = (enabled = true) => {
  const user = useAuthStore ? useAuthStore((state) => state?.profile) : null
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  const updateUserStatus = useCallback(
    async (newStatus: 'ONLINE' | 'OFFLINE') => {
      if (!user) return
      const lastStatus = sessionStorage.getItem('userLastStatus')

      if (newStatus !== lastStatus || user.status !== newStatus) {
        try {
          sessionStorage.setItem('userLastStatus', newStatus)
          console.info(`Updated user status: ${newStatus}`)
          await updateUser(user.id, { status: newStatus })
        } catch (error) {
          console.error('Failed to update user status', error)
        }
      }
    },
    [user]
  )

  const sendHeartbeat = useCallback(async () => {
    if (!user || document.visibilityState !== 'visible') return
    try {
      await updateUser(user.id, { status: ONLINE })
    } catch {
      // Silent fail - heartbeat is best effort
    }
  }, [user])

  const debouncedUpdateUserStatus = useMemo(
    () => debounce(updateUserStatus, 3000),
    [updateUserStatus]
  )

  const handleOnline = useCallback(
    () => debouncedUpdateUserStatus(ONLINE),
    [debouncedUpdateUserStatus]
  )

  const handleOffline = useCallback(
    () => debouncedUpdateUserStatus(OFFLINE),
    [debouncedUpdateUserStatus]
  )

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)
  }, [sendHeartbeat])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      handleOnline()
      startHeartbeat()
    } else {
      handleOffline()
      stopHeartbeat()
    }
  }, [handleOnline, handleOffline, startHeartbeat, stopHeartbeat])

  const handleUnload = useCallback(() => {
    if (!user) return

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        console.info('Service worker ready', registration)
        // @ts-ignore
        registration.active?.postMessage({
          type: 'UPDATE_USER_STATUS',
          payload: { userId: user?.id, status: OFFLINE }
        })
      })
    }
  }, [user])

  useEffect(() => {
    if (!enabled) return

    handleOnline()

    if (document.visibilityState === 'visible') {
      startHeartbeat()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeunload', handleOffline)
    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopHeartbeat()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleOffline)
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      debouncedUpdateUserStatus.cancel()
    }
  }, [
    enabled,
    handleOnline,
    handleOffline,
    handleUnload,
    handleVisibilityChange,
    startHeartbeat,
    stopHeartbeat,
    debouncedUpdateUserStatus
  ])
}
