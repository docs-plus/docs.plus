import { useCallback, useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { updateUser } from '@api'
import { useAuthStore } from '@stores'

const ONLINE = 'ONLINE'
const OFFLINE = 'OFFLINE'

export const useHandleUserStatus = () => {
  // Add a null check in case the store isn't ready
  const user = useAuthStore ? useAuthStore((state) => state?.profile) : null

  const updateUserStatus = async (newStatus: 'ONLINE' | 'OFFLINE') => {
    // Safety check for the store
    if (!useAuthStore || typeof useAuthStore.getState !== 'function') return

    const user = useAuthStore.getState()?.profile
    if (!user) return
    const lastStatus = sessionStorage.getItem('userLastStatus')

    if (newStatus !== lastStatus || user.status !== newStatus) {
      try {
        sessionStorage.setItem('userLastStatus', newStatus)
        console.info(`Updated user status: ${newStatus}`)
        await updateUser(user.id, {
          status: newStatus
        })
      } catch (error) {
        console.error('Failed to update user status', error)
      }
    }
  }

  // Debounced updateUserStatus function
  const debouncedUpdateUserStatus = useMemo(() => debounce(updateUserStatus, 3000), [])

  // Handlers
  const handleOnline = useCallback(
    () => debouncedUpdateUserStatus(ONLINE),
    [debouncedUpdateUserStatus]
  )

  const handleOffline = useCallback(
    () => debouncedUpdateUserStatus(OFFLINE),
    [debouncedUpdateUserStatus]
  )

  const handleUnload = () => {
    if (!user) return

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        // @ts-ignore
        registration.active.postMessage({
          type: 'UPDATE_USER_STATUS',
          payload: {
            userId: user?.id,
            status: OFFLINE
          }
        })
      })
    }
  }

  useEffect(() => {
    if (!user) return
    window.addEventListener('beforeunload', handleUnload)

    // first mount status
    handleOnline()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeunload', handleOffline)
    document.addEventListener('visibilitychange', () => {
      document.visibilityState === 'visible' ? handleOnline() : handleOffline()
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleOffline)

      window.removeEventListener('beforeunload', handleUnload)

      document.removeEventListener('visibilitychange', () => {
        document.visibilityState === 'visible' ? handleOnline() : handleOffline()
      })
      // @ts-ignore
      debouncedUpdateUserStatus.cancel()
    }
  }, [handleOnline, handleOffline, debouncedUpdateUserStatus, user])
}
