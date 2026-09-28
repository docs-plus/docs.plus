import type { HocuspocusProvider } from '@hocuspocus/provider'
import { useEffect } from 'react'

// Matches READING_MSG in the collaboration server's occupancy extension.
const READING_MSG = 'reading'

/**
 * Tells the server whether this tab can be seen, so a background tab never moves
 * Last left forward. Sent after each sync, because a reconnect starts a new
 * server-side session that assumes a visible tab.
 */
const useReportTabReading = (provider: HocuspocusProvider) => {
  useEffect(() => {
    const report = () => {
      provider.sendStateless(
        JSON.stringify({ msg: READING_MSG, visible: document.visibilityState === 'visible' })
      )
    }
    provider.on('synced', report)
    document.addEventListener('visibilitychange', report)
    if (provider.isSynced) report()
    return () => {
      provider.off('synced', report)
      document.removeEventListener('visibilitychange', report)
    }
  }, [provider])
}

export default useReportTabReading
