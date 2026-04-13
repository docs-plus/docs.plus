import { parseHistoryHash } from '@components/pages/history/historyShareUrl'
import { useEffect, useState } from 'react'

function readHistoryHashState() {
  if (typeof window === 'undefined') {
    return { isHistoryView: false, requestedVersion: null as number | null }
  }
  const p = parseHistoryHash(window.location.hash)
  const requestedVersion = p.versionQueryInvalid ? null : p.version
  return { isHistoryView: p.isHistory, requestedVersion }
}

export type HashRouterState = {
  isHistoryView: boolean
  requestedVersion: number | null
}

export const useHashRouter = (): HashRouterState => {
  const [state, setState] = useState<HashRouterState>(readHistoryHashState)

  useEffect(() => {
    const checkHash = () => {
      setState(readHistoryHashState())
    }

    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  return state
}
