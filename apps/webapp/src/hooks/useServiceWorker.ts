import { captureMessageOnce } from '@utils/observability'
import { useCallback, useEffect } from 'react'

// captureMessage events carry no `exception`, so instrumentation-client's
// SW_LIFECYCLE_PATTERNS filter (exception-only) never drops these reports.
// Once per kind per page load — the periodic poll would repeat the same failure.
const reportSwIssue = (kind: string, detail: unknown) =>
  captureMessageOnce(`sw:${kind}`, `sw:${kind}`, {
    level: 'warning',
    tags: { surface: 'service-worker' },
    extra: { detail: detail instanceof Error ? detail.message : String(detail ?? '') }
  })

/**
 * Keeps PWA clients on the newest deploy: next-pwa registers sw.js, this hook
 * sends SKIP_WAITING when a new one installs and reloads on controllerchange.
 * Update checks run on load, visibilitychange, focus, online, and a 10-min poll.
 */
const useServiceWorker = () => {
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

    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      console.info('[SW] New version activated, reloading…')
      window.location.reload()
    }

    const handleStateChange = (
      event: Event,
      reg: ServiceWorkerRegistration,
      priorActive: ServiceWorker | null
    ) => {
      const sw = event.target as ServiceWorker
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        // There's already a controller → this is an UPDATE, not first install
        console.info('[SW] New version available, activating…')
        activateWaitingWorker()
      }
      if (
        sw.state === 'redundant' &&
        !refreshing &&
        !reg.installing &&
        !reg.waiting &&
        reg.active === priorActive
      ) {
        // Redundant only signals failure when nothing replaced the worker.
        // Back-to-back deploys can activate a successor before this callback runs,
        // leaving installing/waiting null but a CHANGED active worker.
        reportSwIssue('worker-redundant', sw.scriptURL)
      }
    }

    const handleUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing
      if (newWorker) {
        // Snapshot the active worker so redundant-time can tell a successor
        // (active changed → benign) from a failed install (active unchanged).
        const priorActive = reg.active
        newWorker.addEventListener('statechange', (event) =>
          handleStateChange(event, reg, priorActive)
        )
      }
    }

    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().catch((error) => {
            // Offline is expected; report failures that happen while online
            if (navigator.onLine) reportSwIssue('update-failed', error)
          })
        }
      })
    }

    // A standalone PWA on iOS/Android never fires 'focus' when it returns from
    // background; visibilitychange is the only reliable foreground signal there.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkForUpdates)
    window.addEventListener('online', checkForUpdates)

    navigator.serviceWorker.ready.then((reg) => {
      // A worker can already be waiting from a previous visit.
      if (reg.waiting) {
        console.info('[SW] Update waiting on load, activating…')
        activateWaitingWorker()
      }

      reg.addEventListener('updatefound', () => handleUpdateFound(reg))

      reg.update().catch((error) => {
        if (navigator.onLine) reportSwIssue('update-failed', error)
      })
    })

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
