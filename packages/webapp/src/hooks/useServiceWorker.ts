import { useEffect } from 'react'

declare global {
  interface Window {
    workbox?: {
      addEventListener: (event: string, callback: () => void) => void
      register: () => void
    }
  }
}

const useServiceWorker = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Register the service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js')
        console.info('Service worker registered:', registration.scope)

        // Check for updates immediately
        registration.update()
      } catch (error) {
        console.error('Service worker registration failed:', error)
      }
    }

    // When new SW is waiting, activate it and reload
    const handleNewVersion = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }

    // Reload when new SW takes control
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    // Check for updates on focus (user returns to tab)
    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update()
      })
    }
    window.addEventListener('focus', checkForUpdates)

    // Workbox integration
    if (window.workbox) {
      window.workbox.addEventListener('waiting', handleNewVersion)
      window.workbox.register()
    } else {
      // No workbox, register manually
      registerServiceWorker()
    }

    return () => {
      window.removeEventListener('focus', checkForUpdates)
    }
  }, [])
}

export default useServiceWorker
