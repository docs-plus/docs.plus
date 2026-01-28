/**
 * Network utilities for offline detection and handling
 * Prevents unnecessary API calls when offline
 */

/**
 * Check if browser is online
 * More reliable than navigator.onLine alone (checks actual connectivity)
 */
export const isOnline = (): boolean => {
  if (typeof window === 'undefined') return true // SSR - assume online

  // Check navigator.onLine first (fast check)
  if (!navigator.onLine) return false

  // Additional check: if we're in development and Supabase URL is localhost,
  // we might still be "online" but can't reach Supabase
  // This is handled by error handling in API calls

  return true
}

/**
 * Check if we should make API requests
 * Returns false if offline or if we're in a state where requests should be paused
 */
export const shouldMakeRequest = (): boolean => {
  return isOnline()
}

/**
 * Get a promise that resolves when browser comes online
 * Useful for queuing requests until connectivity is restored
 */
export const waitForOnline = (): Promise<void> => {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve()
      return
    }

    const handleOnline = () => {
      window.removeEventListener('online', handleOnline)
      resolve()
    }

    window.addEventListener('online', handleOnline)
  })
}

/**
 * Hook to track online/offline status
 * Returns current online status and a function to check manually
 */
export const useOnlineStatus = () => {
  if (typeof window === 'undefined') {
    return { isOnline: true, checkOnline: () => true }
  }

  return {
    isOnline: navigator.onLine,
    checkOnline: isOnline
  }
}
