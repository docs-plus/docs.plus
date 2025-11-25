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
    }

    return () => {
      window.removeEventListener('focus', checkForUpdates)
    }
  }, [])
}

export default useServiceWorker
