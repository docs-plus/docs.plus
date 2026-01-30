import { useCallback, useEffect } from 'react'

/**
 * Service Worker Update Hook
 *
 * Handles automatic updates for the PWA service worker (sw.js).
 * next-pwa handles registration automatically via `register: true` in next.config.js.
 * This hook manages:
 * - Detecting when a new version is available
 * - Prompting/auto-updating to the new version
 * - Reloading the page after update
 */
const useServiceWorker = () => {
  // Handle activating a waiting service worker
  const activateWaitingWorker = useCallback(() => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        // Tell the waiting SW to skip waiting and become active
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let refreshing = false

    // Reload page when new SW takes control
    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      console.info('[SW] New version activated, reloading...')
      window.location.reload()
    }

    // When SW finds an update, activate it
    const handleStateChange = (event: Event) => {
      const sw = event.target as ServiceWorker
      if (sw.state === 'installed') {
        // New SW installed, check if there's a controller (existing SW)
        if (navigator.serviceWorker.controller) {
          console.info('[SW] New version available, activating...')
          activateWaitingWorker()
        }
      }
    }

    // Listen for new service workers
    const handleUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', handleStateChange)
      }
    }

    // Register listeners
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // Check for updates on tab focus
    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().catch(() => {
            // Silent fail - network might be offline
          })
        }
      })
    }

    // Setup update checking
    navigator.serviceWorker.ready.then((reg) => {
      // Check for waiting worker on load
      if (reg.waiting) {
        console.info('[SW] Update waiting on load, activating...')
        activateWaitingWorker()
      }

      // Listen for future updates
      reg.addEventListener('updatefound', () => handleUpdateFound(reg))

      // Check for updates immediately
      reg.update()
    })

    // Check for updates when user returns to tab
    window.addEventListener('focus', checkForUpdates)

    // Check for updates periodically (every 30 minutes)
    const updateInterval = setInterval(checkForUpdates, 30 * 60 * 1000)

    return () => {
      window.removeEventListener('focus', checkForUpdates)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      clearInterval(updateInterval)
    }
  }, [activateWaitingWorker])
}

export default useServiceWorker
