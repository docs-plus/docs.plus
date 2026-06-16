import { parseHistoryHash } from '@components/pages/history/historyShareUrl'
import Router from 'next/router'
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
    const sync = () => {
      setState(readHistoryHashState())
    }

    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    Router.events.on('hashChangeComplete', sync)
    Router.events.on('routeChangeComplete', sync)

    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
      Router.events.off('hashChangeComplete', sync)
      Router.events.off('routeChangeComplete', sync)
    }
  }, [])

  return state
}
