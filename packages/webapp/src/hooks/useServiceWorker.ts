import { useCallback, useEffect } from 'react'

/**
 * Service Worker Update Hook
 *
 * Ensures PWA clients always get the latest version after a deploy.
 *
 * How it works:
 * ─────────────────────────────────────────────────────────────
 * 1. next-pwa registers sw.js automatically (register: true)
 * 2. This hook detects when a NEW sw.js is downloaded
 * 3. Sends SKIP_WAITING → new SW activates immediately
 * 4. On controllerchange → page reloads with fresh assets
 *
 * Update triggers (belt-and-suspenders):
 * ─────────────────────────────────────────────────────────────
 * - On page load (immediate)
 * - On visibilitychange (app returns from background — mobile PWA)
 * - On focus (desktop tab switching — belt for desktop)
 * - On online (reconnection after offline)
 * - Every 10 minutes (periodic poll)
 *
 * Why visibilitychange and NOT just focus:
 *   iOS/Android standalone PWA does NOT fire 'focus' when
 *   the app returns from background. 'visibilitychange' is
 *   the only reliable event for mobile PWA foreground detection.
 * ─────────────────────────────────────────────────────────────
 */
const useServiceWorker = () => {
  // Tell waiting SW to skip waiting and become the active SW
  const activateWaitingWorker = useCallback(() => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let refreshing = false

    // ── Reload when new SW takes control ──
    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      console.info('[SW] New version activated, reloading…')
      window.location.reload()
    }

    // ── When new SW finishes installing, activate it ──
    const handleStateChange = (event: Event) => {
      const sw = event.target as ServiceWorker
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        // There's already a controller → this is an UPDATE, not first install
        console.info('[SW] New version available, activating…')
        activateWaitingWorker()
      }
    }

    // ── Track installing workers for state changes ──
    const handleUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', handleStateChange)
      }
    }

    // ── Check for SW updates (call reg.update()) ──
    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().catch(() => {
            // Silent fail — network might be offline
          })
        }
      })
    }

    // ── visibilitychange: the RELIABLE event for mobile PWA ──
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }

    // ── Register all listeners ──
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkForUpdates) // belt for desktop
    window.addEventListener('online', checkForUpdates) // reconnection

    // ── Initial setup when SW is ready ──
    navigator.serviceWorker.ready.then((reg) => {
      // If there's already a waiting worker (e.g. from previous visit), activate it
      if (reg.waiting) {
        console.info('[SW] Update waiting on load, activating…')
        activateWaitingWorker()
      }

      // Listen for future updates
      reg.addEventListener('updatefound', () => handleUpdateFound(reg))

      // Check for updates immediately on load
      reg.update()
    })

    // ── Periodic check every 10 minutes ──
    const updateInterval = setInterval(checkForUpdates, 10 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', checkForUpdates)
      window.removeEventListener('online', checkForUpdates)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      clearInterval(updateInterval)
    }
  }, [activateWaitingWorker])
}

export default useServiceWorker
