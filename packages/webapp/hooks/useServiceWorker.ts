// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect } from 'react'

const useServiceWorker = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => console.info('scope is: ', registration.scope))
    }
  }, [])

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.workbox !== undefined
    ) {
      const wb = window.workbox

      // Add event listeners
      const handleInstall = (event) => {
        console.info(`Event ${event.type} is triggered.`, event)
      }

      const handleControlling = (event) => {
        console.info(`Event ${event.type} is triggered.`, event)
      }

      const handleActivated = (event) => {
        console.info(`Event ${event.type} is triggered.`, event)
      }

      const promptNewVersionAvailable = (event) => {
        // Custom logic for prompting new version
        console.info(`Event ${event.type} is triggered.`, event)
        // ...
      }

      const handleMessage = (event) => {
        console.info(`Event ${event.type} is triggered.`, event)
      }

      wb.addEventListener('installed', handleInstall)
      wb.addEventListener('controlling', handleControlling)
      wb.addEventListener('activated', handleActivated)
      wb.addEventListener('waiting', promptNewVersionAvailable)
      wb.addEventListener('message', handleMessage)

      // Register the service worker
      wb.register()

      // Cleanup function
      return () => {
        wb.removeEventListener('installed', handleInstall)
        wb.removeEventListener('controlling', handleControlling)
        wb.removeEventListener('activated', handleActivated)
        wb.removeEventListener('waiting', promptNewVersionAvailable)
        wb.removeEventListener('message', handleMessage)
      }
    }
  }, [])
}

export default useServiceWorker
